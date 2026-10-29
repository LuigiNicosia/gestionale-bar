import os

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "database_mysql"),
    "charset": "utf8mb4",
}

try:
    from config_local import DB_CONFIG as LOCAL_CONFIG
    DB_CONFIG.update(LOCAL_CONFIG)
except ImportError:
    pass
