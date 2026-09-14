"""Dependency-free English readability metrics and recommendations."""

from __future__ import annotations

import re
from collections import Counter

MAX_CHARACTERS = 2_000_000
WORD_PATTERN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")


class ReadabilityError(ValueError):
    """Raised when text cannot be meaningfully analyzed."""


def count_syllables(word: str) -> int:
    clean = re.sub(r"[^a-z]", "", word.lower())
    if not clean:
        return 0
    groups = re.findall(r"[aeiouy]+", clean)
    count = len(groups)
    if clean.endswith("e") and not clean.endswith(("le", "ye")) and count > 1:
        count -= 1
    return max(1, count)


def split_sentences(text: str) -> list[str]:
    return [value.strip() for value in re.split(r"(?<=[.!?])\s+|\n+", text) if value.strip()]


def analyze(text: str) -> dict[str, object]:
    if not isinstance(text, str):
        raise ReadabilityError("Input must be text")
    if len(text) > MAX_CHARACTERS:
        raise ReadabilityError("Input exceeds the 2,000,000 character safety limit")
    words = WORD_PATTERN.findall(text)
    if len(words) < 3:
        raise ReadabilityError("At least three words are required")
    sentences = split_sentences(text)
    if not sentences:
        raise ReadabilityError("At least one sentence is required")
    paragraphs = [value.strip() for value in re.split(r"\n\s*\n", text) if value.strip()]
    syllables = sum(count_syllables(word) for word in words)
    word_count = len(words)
    sentence_count = len(sentences)
    paragraph_count = len(paragraphs)
    average_sentence = word_count / sentence_count
    average_syllables = syllables / word_count
    reading_ease = 206.835 - 1.015 * average_sentence - 84.6 * average_syllables
    grade = 0.39 * average_sentence + 11.8 * average_syllables - 15.59
    sentence_lengths = [len(WORD_PATTERN.findall(sentence)) for sentence in sentences]
    paragraph_lengths = [len(WORD_PATTERN.findall(paragraph)) for paragraph in paragraphs]
    passive_pattern = re.compile(r"\b(?:am|is|are|was|were|be|been|being)\s+\w+(?:ed|en)\b", re.IGNORECASE)
    passive_signals = len(passive_pattern.findall(text))
    complex_words = [word.lower() for word in words if len(word) >= 7 and count_syllables(word) >= 3]
    top_complex = [{"word": word, "count": count} for word, count in Counter(complex_words).most_common(8)]

    recommendations = []
    long_sentences = sum(length > 25 for length in sentence_lengths)
    long_paragraphs = sum(length > 120 for length in paragraph_lengths)
    if long_sentences:
        recommendations.append("Split " + str(long_sentences) + " sentence(s) longer than 25 words.")
    if long_paragraphs:
        recommendations.append("Break up " + str(long_paragraphs) + " paragraph(s) longer than 120 words.")
    if grade > 10:
        recommendations.append("Replace some complex words or shorten sentences to lower the grade level.")
    if passive_signals:
        recommendations.append("Review " + str(passive_signals) + " possible passive-voice construction(s).")
    if not recommendations:
        recommendations.append("No configured clarity threshold was exceeded.")

    return {
        "characters": len(text),
        "words": word_count,
        "sentences": sentence_count,
        "paragraphs": paragraph_count,
        "syllables": syllables,
        "reading_minutes": round(word_count / 200, 2),
        "average_sentence_words": round(average_sentence, 2),
        "reading_ease": round(reading_ease, 2),
        "grade_level": round(max(0, grade), 2),
        "long_sentences": long_sentences,
        "long_paragraphs": long_paragraphs,
        "passive_voice_signals": passive_signals,
        "top_complex_words": top_complex,
        "recommendations": recommendations,
    }

