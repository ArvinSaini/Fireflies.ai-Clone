"""Domain errors raised by the service layer.

Services know nothing about HTTP; `app.main` maps these to status codes in one place
(NotFound → 404, Conflict → 409, InvalidInput → 422).
"""


class DomainError(Exception):
    """Base class for expected, user-facing failures."""


class NotFound(DomainError, LookupError):
    pass


class Conflict(DomainError):
    pass


class InvalidInput(DomainError, ValueError):
    pass
