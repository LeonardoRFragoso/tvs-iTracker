"""
Migration: Add background_audio_content_id to campaigns table
Date: 2025-01-09
Description: Adds support for persistent background audio in campaigns
"""

import sys
import os

# Add parent directory to path to import database module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import db
from sqlalchemy import text

def upgrade():
    """Add background_audio_content_id column to campaigns table"""
    try:
        with db.engine.connect() as conn:
            # Check if column already exists
            result = conn.execute(text("PRAGMA table_info(campaigns)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'background_audio_content_id' not in columns:
                print("Adding background_audio_content_id column to campaigns table...")
                conn.execute(text(
                    """
                    ALTER TABLE campaigns 
                    ADD COLUMN background_audio_content_id VARCHAR(36)
                    """
                ))
                conn.commit()
                print("✓ Column background_audio_content_id added successfully")
            else:
                print("✓ Column background_audio_content_id already exists")
                
        print("Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"Error during migration: {str(e)}")
        return False

def downgrade():
    """Remove background_audio_content_id column from campaigns table"""
    try:
        with db.engine.connect() as conn:
            # SQLite doesn't support DROP COLUMN directly
            # We would need to create a new table without the column and copy data
            print("WARNING: SQLite doesn't support DROP COLUMN.")
            print("To downgrade, you would need to recreate the table without the column.")
            print("This operation is not implemented to prevent data loss.")
        return True
        
    except Exception as e:
        print(f"Error during downgrade: {str(e)}")
        return False

if __name__ == '__main__':
    # This allows running the migration standalone
    from app import app
    with app.app_context():
        upgrade()

