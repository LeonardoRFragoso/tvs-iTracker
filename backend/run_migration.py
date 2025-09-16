#!/usr/bin/env python3
"""
Script to run database migration for schedule persistence fields
"""

import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the migration
from migrations.add_schedule_persistence_fields import run_migration

if __name__ == "__main__":
    print("Running database migration for schedule persistence fields...")
    run_migration()
    print("Migration completed!")
