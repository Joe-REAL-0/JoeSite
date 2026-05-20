import secrets
import time

EMAIL_LINK_TTL = 3600
OAUTH_BIND_TTL = 3600
REGISTER_BIND_TTL = 3600

email_link_tokens = {}
pending_oauth_bindings = {}
pending_register_bindings = {}


def _purge_expired(store):
    current_time = time.time()
    expired_keys = [key for key, value in store.items() if value.get('expires_at', 0) < current_time]
    for key in expired_keys:
        store.pop(key, None)


def purge_expired_link_state():
    _purge_expired(email_link_tokens)
    _purge_expired(pending_oauth_bindings)
    _purge_expired(pending_register_bindings)


def create_email_link_token(payload, ttl=EMAIL_LINK_TTL):
    purge_expired_link_state()
    token = secrets.token_urlsafe(32)
    email_link_tokens[token] = {
        'payload': payload,
        'created_at': time.time(),
        'expires_at': time.time() + ttl,
    }
    return token


def pop_email_link_token(token):
    purge_expired_link_state()
    return email_link_tokens.pop(token, None)


def peek_email_link_token(token):
    purge_expired_link_state()
    return email_link_tokens.get(token)


def create_pending_oauth_binding(payload, ttl=OAUTH_BIND_TTL):
    purge_expired_link_state()
    token = secrets.token_urlsafe(32)
    pending_oauth_bindings[token] = {
        'payload': payload,
        'created_at': time.time(),
        'expires_at': time.time() + ttl,
    }
    return token


def peek_pending_oauth_binding(token):
    purge_expired_link_state()
    return pending_oauth_bindings.get(token)


def pop_pending_oauth_binding(token):
    purge_expired_link_state()
    return pending_oauth_bindings.pop(token, None)


def create_pending_registration(payload, ttl=REGISTER_BIND_TTL):
    purge_expired_link_state()
    token = secrets.token_urlsafe(32)
    pending_register_bindings[token] = {
        'payload': payload,
        'created_at': time.time(),
        'expires_at': time.time() + ttl,
    }
    return token


def peek_pending_registration(token):
    purge_expired_link_state()
    return pending_register_bindings.get(token)


def pop_pending_registration(token):
    purge_expired_link_state()
    return pending_register_bindings.pop(token, None)