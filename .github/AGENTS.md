# JoeSite agent notes

## Quick start
- Install: `pip install -r requirements.txt`
- Run (dev): `python app.py` (listens on port 30069)
- Run (wsgi): `python wsgi.py` (default Flask port 5000)

## Project map
- Flask app is created and configured in `app/__init__.py`; blueprints are registered there.
- Route modules live in `app/` (auth, main, user, message, manage, blog, seo).
- Frontend templates are in `templates/`; static assets are in `static/`.
- SQLite database lives at `./database.db` and is managed by `database.py` (schema created on connect).

## Environment and config
- `MAIL_USERNAME` and `MAIL_PASSWORD` are loaded via dotenv in `app/__init__.py`.
- Production defaults and optional `SECRET_KEY` override are in `wsgi.py`.

## References
- Project overview and run commands: [README.md](README.md)
