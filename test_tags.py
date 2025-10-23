#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from models.content import Content
from app import app, db

def test_tags():
    with app.app_context():
        # Buscar conteúdos com tags
        contents_with_tags = Content.query.filter(Content.tags.isnot(None)).filter(Content.tags != '').all()
        
        print(f"Total de conteúdos: {Content.query.count()}")
        print(f"Conteúdos com tags: {len(contents_with_tags)}")
        
        if contents_with_tags:
            print("\nExemplos de conteúdos com tags:")
            for content in contents_with_tags[:5]:
                print(f"- {content.title}: {content.tags}")
        else:
            print("\nNenhum conteúdo possui tags!")
            
        # Buscar todas as tags únicas
        import json
        all_tags = set()
        for content in contents_with_tags:
            if content.tags:
                try:
                    parsed = json.loads(content.tags)
                    if isinstance(parsed, list):
                        all_tags.update(parsed)
                    elif isinstance(parsed, str):
                        all_tags.add(parsed)
                except:
                    # Fallback para CSV
                    tags = [t.strip() for t in content.tags.split(',') if t.strip()]
                    all_tags.update(tags)
        
        print(f"\nTags únicas encontradas: {sorted(all_tags)}")

if __name__ == '__main__':
    test_tags()
