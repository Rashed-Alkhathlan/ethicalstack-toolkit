from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class GlossaryEntry(BaseModel):
    english_term: str
    english_def: Optional[str] = None
    arabic_term: Optional[str] = None
    arabic_def: Optional[str] = None
    french_term: Optional[str] = None
    french_def: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    total: int
    offset: int = 0
    limit: int = 25
    results: List[GlossaryEntry]


class AnnotateRequest(BaseModel):
    text: str


class AnnotateBatchRequest(BaseModel):
    texts: List[str]


class AnnotationMatch(BaseModel):
    term: str
    start: int
    end: int
    matched_text: Optional[str] = None
    definition: Optional[str] = None


class AnnotationResponse(BaseModel):
    text: str
    match_count: int
    matches: List[AnnotationMatch]


class AnnotateBatchItem(BaseModel):
    text: str
    match_count: int
    matches: List[AnnotationMatch]


class AnnotateBatchResponse(BaseModel):
    total: int
    results: List[AnnotateBatchItem]


class SemanticSearchResult(BaseModel):
    score: float
    entry: GlossaryEntry


class SemanticSearchResponse(BaseModel):
    query: str
    total: int
    offset: int = 0
    limit: int = 10
    results: List[SemanticSearchResult]


class ListTermsResponse(BaseModel):
    total: int
    offset: int
    limit: int
    results: List[GlossaryEntry]


class AuditRequest(BaseModel):
    text: str


class AuditCategory(BaseModel):
    key: str
    label: str
    description: str
    matched_terms: List[str]
    match_count: int
    present: bool
    score: float
    severity: str
    recommendation: str
    evidence: List[str] = Field(default_factory=list)
    category_gaps: List[str] = Field(default_factory=list)


class AuditResponse(BaseModel):
    summary: str
    overall_severity: str
    coverage_score: float
    term_density: float
    word_count: int
    match_count: int
    matches: List[AnnotationMatch]
    categories: List[AuditCategory]
    gaps: List[str]
    strengths: List[str]
    backend: str = "keyword"
    model: Optional[str] = None


class AutocompleteSuggestion(BaseModel):
    term: str
    definition: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)


class AutocompleteResponse(BaseModel):
    query: str
    suggestions: List[AutocompleteSuggestion]
