"""A deliberately mixed example for DocstringGauge."""


class GreetingService:
    """Build friendly greetings."""

    def greet(self, name: str) -> str:
        """Return a greeting for one name."""
        return f"Hello, {name}!"

    def excited(self, name: str) -> str:
        return self.greet(name).upper()


def version() -> str:
    """Return this example's version."""
    return "1.0"

