"""Zenty API entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .db import init_db
from .routers import account, auth, bank, finance, internal
from .security import SESSION_COOKIE, csrf_ok

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("zenty")
settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Zenty API",
    version="2.0.0",
    docs_url=None if settings.is_prod else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_prod else "/api/openapi.json",
)

# Frontend and API share one origin in production, so CORS stays locked down.
# Only the local Vite dev server is allowed cross-origin during development.
if not settings.is_prod:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Requested-With"],
    )

UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    path = request.url.path
    if request.method in UNSAFE and path.startswith("/api/") and not path.startswith("/api/internal/"):
        # 1) Custom header: browsers can't send it cross-site without a CORS preflight we refuse.
        if request.headers.get("x-requested-with") != "zenty":
            return JSONResponse({"detail": "Request blocked."}, status_code=403)
        # 2) Signed-in requests also need the double-submit CSRF token.
        if request.cookies.get(SESSION_COOKIE) and not csrf_ok(request):
            return JSONResponse({"detail": "Security check failed. Please refresh the page."}, status_code=403)

    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"  # never cache financial data
    if settings.is_prod:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "input"
    if field == "email":
        return JSONResponse({"detail": "Please enter a valid email address."}, status_code=422)
    return JSONResponse({"detail": f"Invalid {field}: {first.get('msg', 'check your input')}"}, status_code=422)


@app.exception_handler(Exception)
async def unhandled_error(_: Request, exc: Exception):
    # Log the type only; never send stack traces or internals to the client.
    log.exception("Unhandled error: %s", type(exc).__name__)
    return JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(account.router)
app.include_router(finance.router)
app.include_router(bank.router)
app.include_router(internal.router)
