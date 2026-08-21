from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SnippetCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    language: str = Field(min_length=1, max_length=30)
    code: str = Field(min_length=1, max_length=10000)
    description: str = Field(default="", max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("title", "language", "code")
    @classmethod
    def required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values if value.strip()]
        if any(len(value) > 30 for value in cleaned):
            raise ValueError("each tag must be 30 characters or fewer")
        return list(dict.fromkeys(cleaned))


class SnippetUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=80)
    language: str | None = Field(default=None, min_length=1, max_length=30)
    code: str | None = Field(default=None, min_length=1, max_length=10000)
    description: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=10)

    @field_validator("title", "language", "code")
    @classmethod
    def optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("value cannot be blank")
        return value

    @field_validator("tags")
    @classmethod
    def clean_optional_tags(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        cleaned = [value.strip() for value in values if value.strip()]
        if any(len(value) > 30 for value in cleaned):
            raise ValueError("each tag must be 30 characters or fewer")
        return list(dict.fromkeys(cleaned))


class SnippetPublic(SnippetCreate):
    id: int
    created_at: datetime
    updated_at: datetime

