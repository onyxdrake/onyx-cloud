#!/usr/bin/env python3
"""
Onyx Embedding Server
Pake scikit-learn TfidfVectorizer — ringan, gak butuh PyTorch.
"""
from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import json
import os

app = Flask(__name__)

# Simpen dokumen + vectorizer
DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'documents.json')
documents = []
vectorizer = None
matrix = None

def load_data():
    global documents
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                documents = json.load(f)
        except:
            documents = []

def save_data():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(documents[-5000:], f)  # max 5000 dokumen

def rebuild_vectorizer():
    global vectorizer, matrix
    if len(documents) == 0:
        vectorizer = None
        matrix = None
        return
    teks_list = [d['text'] for d in documents]
    vectorizer = TfidfVectorizer(max_features=1000, stop_words=None)
    matrix = vectorizer.fit_transform(teks_list)

@app.route('/embed', methods=['POST'])
def embed():
    """Tambah dokumen ke index."""
    global documents
    data = request.json
    text = data.get('text', '')
    if not text:
        return jsonify({'error': 'Text kosong'}), 400
    documents.append({'text': text, 'ts': data.get('ts', 0)})
    save_data()
    rebuild_vectorizer()
    return jsonify({'ok': True, 'total': len(documents)})

@app.route('/search', methods=['POST'])
def search():
    """Cari dokumen mirip."""
    global vectorizer, matrix
    if vectorizer is None or matrix is None or len(documents) == 0:
        return jsonify({'results': []})
    query = request.json.get('query', '')
    limit = request.json.get('limit', 5)
    query_vec = vectorizer.transform([query])
    # Cosine similarity
    from sklearn.metrics.pairwise import cosine_similarity
    sims = cosine_similarity(query_vec, matrix)[0]
    idx = np.argsort(sims)[::-1][:limit]
    results = []
    for i in idx:
        if sims[i] > 0.05:
            results.append({
                'text': documents[i]['text'],
                'score': float(sims[i])
            })
    return jsonify({'results': results})

@app.route('/stats', methods=['GET'])
def stats():
    return jsonify({'total': len(documents)})

if __name__ == '__main__':
    load_data()
    rebuild_vectorizer()
    print(f'📚 Load {len(documents)} dokumen')
    print('🚀 Embed server di http://127.0.0.1:5001')
    app.run(port=5001, host='127.0.0.1')
