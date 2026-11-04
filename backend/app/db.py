from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from .config import get_settings

settings = get_settings()

if settings.database_url.startswith("sqlite"):
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
else:
    # Serverless functions are short-lived: let the provider's pooler (e.g. Neon's
    # "-pooler" host) handle pooling instead of holding connections open here.
    engine = create_engine(settings.database_url, poolclass=NullPool, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (registers tables)

    Base.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """create_all() never alters existing tables, so add any new columns here.
    Safe to run on every start and from several server instances at once:
    it only adds missing columns, and never stops the app from starting."""
    import logging

    from sqlalchemy import inspect, text

    log = logging.getLogger("zenty.db")
    insp = inspect(engine)
    pg = engine.dialect.name == "postgresql"
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            ddl_type = col.type.compile(dialect=engine.dialect)
            default = ""
            if col.default is not None and getattr(col.default, "is_scalar", False):
                v = col.default.arg
                default = f" DEFAULT {'TRUE' if v is True else 'FALSE' if v is False else repr(v)}"
                if engine.dialect.name == "sqlite" and isinstance(v, bool):
                    default = f" DEFAULT {int(v)}"
            guard = "IF NOT EXISTS " if pg else ""
            try:
                with engine.begin() as conn:
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN {guard}"{col.name}" {ddl_type}{default}'))
            except Exception as exc:  # another instance may have added it a moment ago
                log.warning("Skipped adding %s.%s: %s", table.name, col.name, type(exc).__name__)
