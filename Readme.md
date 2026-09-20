Search Engine
A lightweight search engine that crawls web pages, builds an inverted index, ranks relevant documents, and returns search results through a web interface. The project is designed to demonstrate how a search engine works internally, from document processing and indexing to query processing and ranking.

🚀 Features
🔎 Keyword-based search
🕷️ Web/document crawling
📚 Inverted index for fast retrieval
🧹 Text preprocessing and tokenization
📊 Document ranking
⚡ Fast search using indexed data
🌐 Web-based search interface
🤖 LLM + RAG integration for AI-powered answers
🔗 Displays traditional search results alongside LLM-generated results
🏗️ Architecture
                 ┌─────────────────┐
                 │   User Query    │
                 └────────┬────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ Query Processing  │
                └─────────┬─────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌────────────────┐     ┌────────────────┐
      │ Inverted Index │     │  RAG Pipeline  │
      └───────┬────────┘     └───────┬────────┘
              │                      │
              ▼                      ▼
      ┌────────────────┐     ┌────────────────┐
      │ Search Ranking │     │      LLM       │
      └───────┬────────┘     └───────┬────────┘
              │                      │
              └──────────┬───────────┘
                         ▼
                ┌──────────────────┐
                │ Search Results   │
                └──────────────────┘
🔍 How It Works
1. Crawling
The crawler collects documents/web pages that will be searchable.

URL → Fetch Page → Extract Content → Store Document
2. Preprocessing
The extracted text is cleaned and converted into searchable tokens.

Typical operations include:

Lowercasing
Tokenization
Removing unnecessary characters
Stop-word removal
Stemming/lemmatization
3. Inverted Index
The search engine creates an inverted index that maps terms to documents.

Example:

"react"  → [doc1, doc4, doc8]
"node"   → [doc2, doc4]
"search" → [doc1, doc2, doc8]
This allows the engine to find relevant documents without scanning every document.

4. Query Processing
When a user searches:

machine learning
the query is processed in the same way as indexed documents.

User Query
    ↓
Tokenization
    ↓
Normalization
    ↓
Term Lookup
    ↓
Candidate Documents
5. Ranking
Retrieved documents are ranked based on their relevance to the query.

Possible ranking techniques include:

TF-IDF
BM25
Term frequency
Document frequency
Cosine similarity
Vector similarity
6. LLM + RAG
The search engine can also use Retrieval-Augmented Generation (RAG).

User Query
    ↓
Retrieve Relevant Documents
    ↓
Create Context
    ↓
Send Context + Query to LLM
    ↓
Generate Answer
The UI can display both:

┌────────────────────────────────────┐
│ AI Answer                          │
│                                    │
│ Generated answer using retrieved   │
│ documents as context.              │
└────────────────────────────────────┘

Search Results
──────────────────────────────────────
1. Document A
2. Document B
3. Document C