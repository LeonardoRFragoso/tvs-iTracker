#!/usr/bin/env python3
"""
Database Structure Analyzer for TVs Platform
Analyzes all tables, columns, constraints, and relationships in tvs_platform.db
"""

import sqlite3
import os
import sys
from datetime import datetime
from typing import Dict, List, Tuple, Any
import json

class DatabaseAnalyzer:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = None
        
    def connect(self):
        """Connect to the SQLite database"""
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database file not found: {self.db_path}")
        
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        
    def disconnect(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            
    def get_all_tables(self) -> List[str]:
        """Get list of all tables in the database"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)
        return [row[0] for row in cursor.fetchall()]
    
    def get_table_info(self, table_name: str) -> List[Dict[str, Any]]:
        """Get detailed column information for a table"""
        cursor = self.conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        
        columns = []
        for row in cursor.fetchall():
            columns.append({
                'cid': row[0],
                'name': row[1],
                'type': row[2],
                'notnull': bool(row[3]),
                'default_value': row[4],
                'pk': bool(row[5])
            })
        return columns
    
    def get_foreign_keys(self, table_name: str) -> List[Dict[str, Any]]:
        """Get foreign key constraints for a table"""
        cursor = self.conn.cursor()
        cursor.execute(f"PRAGMA foreign_key_list({table_name})")
        
        foreign_keys = []
        for row in cursor.fetchall():
            foreign_keys.append({
                'id': row[0],
                'seq': row[1],
                'table': row[2],
                'from': row[3],
                'to': row[4],
                'on_update': row[5],
                'on_delete': row[6],
                'match': row[7]
            })
        return foreign_keys
    
    def get_indexes(self, table_name: str) -> List[Dict[str, Any]]:
        """Get indexes for a table"""
        cursor = self.conn.cursor()
        cursor.execute(f"PRAGMA index_list({table_name})")
        
        indexes = []
        for row in cursor.fetchall():
            index_name = row[1]
            # Get index info
            cursor.execute(f"PRAGMA index_info({index_name})")
            columns = [col[2] for col in cursor.fetchall()]
            
            indexes.append({
                'seq': row[0],
                'name': index_name,
                'unique': bool(row[2]),
                'origin': row[3],
                'partial': bool(row[4]),
                'columns': columns
            })
        return indexes
    
    def get_table_row_count(self, table_name: str) -> int:
        """Get row count for a table"""
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        return cursor.fetchone()[0]
    
    def get_table_schema(self, table_name: str) -> str:
        """Get CREATE TABLE statement for a table"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name=?
        """, (table_name,))
        result = cursor.fetchone()
        return result[0] if result else ""
    
    def analyze_relationships(self) -> Dict[str, List[Dict[str, str]]]:
        """Analyze relationships between tables"""
        relationships = {}
        tables = self.get_all_tables()
        
        for table in tables:
            foreign_keys = self.get_foreign_keys(table)
            if foreign_keys:
                relationships[table] = []
                for fk in foreign_keys:
                    relationships[table].append({
                        'references_table': fk['table'],
                        'local_column': fk['from'],
                        'foreign_column': fk['to'],
                        'on_delete': fk['on_delete'],
                        'on_update': fk['on_update']
                    })
        
        return relationships
    
    def generate_report(self, output_format: str = 'text') -> str:
        """Generate comprehensive database analysis report"""
        if not self.conn:
            self.connect()
        
        report_data = {
            'analysis_date': datetime.now().isoformat(),
            'database_path': self.db_path,
            'tables': {},
            'relationships': self.analyze_relationships(),
            'summary': {}
        }
        
        tables = self.get_all_tables()
        total_rows = 0
        
        for table in tables:
            columns = self.get_table_info(table)
            foreign_keys = self.get_foreign_keys(table)
            indexes = self.get_indexes(table)
            row_count = self.get_table_row_count(table)
            schema = self.get_table_schema(table)
            
            total_rows += row_count
            
            report_data['tables'][table] = {
                'columns': columns,
                'foreign_keys': foreign_keys,
                'indexes': indexes,
                'row_count': row_count,
                'schema': schema
            }
        
        report_data['summary'] = {
            'total_tables': len(tables),
            'total_rows': total_rows,
            'tables_with_relationships': len(report_data['relationships'])
        }
        
        if output_format == 'json':
            return json.dumps(report_data, indent=2, default=str)
        else:
            return self._format_text_report(report_data)
    
    def _format_text_report(self, data: Dict) -> str:
        """Format report data as readable text"""
        report = []
        report.append("=" * 80)
        report.append("DATABASE STRUCTURE ANALYSIS REPORT")
        report.append("=" * 80)
        report.append(f"Database: {data['database_path']}")
        report.append(f"Analysis Date: {data['analysis_date']}")
        report.append("")
        
        # Summary
        report.append("SUMMARY")
        report.append("-" * 40)
        report.append(f"Total Tables: {data['summary']['total_tables']}")
        report.append(f"Total Rows: {data['summary']['total_rows']:,}")
        report.append(f"Tables with Relationships: {data['summary']['tables_with_relationships']}")
        report.append("")
        
        # Tables
        report.append("TABLES ANALYSIS")
        report.append("-" * 40)
        
        for table_name, table_data in data['tables'].items():
            report.append(f"\nTable: {table_name.upper()}")
            report.append(f"Rows: {table_data['row_count']:,}")
            report.append("")
            
            # Columns
            report.append("  Columns:")
            for col in table_data['columns']:
                pk_marker = " (PK)" if col['pk'] else ""
                null_marker = " NOT NULL" if col['notnull'] else " NULL"
                default = f" DEFAULT {col['default_value']}" if col['default_value'] else ""
                report.append(f"    {col['name']}: {col['type']}{pk_marker}{null_marker}{default}")
            
            # Foreign Keys
            if table_data['foreign_keys']:
                report.append("  Foreign Keys:")
                for fk in table_data['foreign_keys']:
                    report.append(f"    {fk['from']} -> {fk['table']}.{fk['to']} (ON DELETE {fk['on_delete']})")
            
            # Indexes
            if table_data['indexes']:
                report.append("  Indexes:")
                for idx in table_data['indexes']:
                    unique_marker = " (UNIQUE)" if idx['unique'] else ""
                    columns_str = ", ".join(idx['columns'])
                    report.append(f"    {idx['name']}: ({columns_str}){unique_marker}")
            
            report.append("")
        
        # Relationships
        if data['relationships']:
            report.append("TABLE RELATIONSHIPS")
            report.append("-" * 40)
            for table, relations in data['relationships'].items():
                report.append(f"\n{table.upper()} references:")
                for rel in relations:
                    report.append(f"  -> {rel['references_table']}.{rel['foreign_column']} via {rel['local_column']}")
        
        return "\n".join(report)

def main():
    """Main function to run the database analyzer"""
    # Default database paths to check
    base_dir = os.path.dirname(__file__)
    possible_paths = [
        os.path.join(base_dir, 'instance', 'tvs_platform.db'),  # Flask instance folder
        os.path.join(base_dir, 'tvs_platform.db'),  # Direct backend folder
    ]
    
    db_path = None
    
    # Allow custom database path as command line argument
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        # Find the database file that exists and has tables
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    # Quick check if database has tables
                    temp_conn = sqlite3.connect(path)
                    cursor = temp_conn.cursor()
                    cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                    table_count = cursor.fetchone()[0]
                    temp_conn.close()
                    
                    if table_count > 0:
                        db_path = path
                        print(f"Found database with {table_count} tables at: {path}")
                        break
                    else:
                        print(f"Database at {path} exists but has no tables")
                except Exception as e:
                    print(f"Error checking database at {path}: {e}")
                    continue
        
        if not db_path:
            # If no database with tables found, use the first existing one
            for path in possible_paths:
                if os.path.exists(path):
                    db_path = path
                    print(f"Using database at: {path} (may be empty)")
                    break
    
    if not db_path:
        print("Error: No database file found!")
        print("Checked locations:")
        for path in possible_paths:
            print(f"  - {path}")
        sys.exit(1)
    
    # Output format (text or json)
    output_format = 'text'
    if len(sys.argv) > 2 and sys.argv[2].lower() == 'json':
        output_format = 'json'
    
    try:
        analyzer = DatabaseAnalyzer(db_path)
        analyzer.connect()
        
        print("Analyzing database structure...")
        report = analyzer.generate_report(output_format)
        
        # Save report to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"database_analysis_{timestamp}.{'json' if output_format == 'json' else 'txt'}"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"Analysis complete! Report saved to: {output_file}")
        print("\nReport preview:")
        print("-" * 50)
        
        # Show preview (first 2000 characters for text, formatted JSON for json)
        if output_format == 'json':
            import json
            data = json.loads(report)
            print(f"Database: {data['database_path']}")
            print(f"Total Tables: {data['summary']['total_tables']}")
            print(f"Total Rows: {data['summary']['total_rows']:,}")
            print(f"Tables: {', '.join(data['tables'].keys())}")
        else:
            preview = report[:2000]
            if len(report) > 2000:
                preview += "\n... (truncated, see full report in file)"
            print(preview)
        
        analyzer.disconnect()
        
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print(f"Make sure the database file exists at: {db_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error analyzing database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
