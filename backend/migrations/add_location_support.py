"""Add Location Support

Revision ID: add_location_support
Revises: 
Create Date: 2024-01-15 21:29:19.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, time

# revision identifiers
revision = 'add_location_support'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    """Apply migration changes"""
    
    # Create locations table
    op.create_table('location',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('city', sa.String(50), nullable=False),
        sa.Column('state', sa.String(2), nullable=False),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='America/Sao_Paulo'),
        sa.Column('network_bandwidth_mbps', sa.Integer, nullable=False, server_default='100'),
        sa.Column('peak_hours_start', sa.Time, nullable=False, server_default='08:00:00'),
        sa.Column('peak_hours_end', sa.Time, nullable=False, server_default='18:00:00'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now())
    )
    
    # Create content_distribution table
    op.create_table('content_distribution',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('content_id', sa.String(36), nullable=False),
        sa.Column('player_id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('priority', sa.String(10), nullable=False, server_default='normal'),
        sa.Column('progress_percentage', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('scheduled_at', sa.DateTime, nullable=True),
        sa.Column('started_at', sa.DateTime, nullable=True),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('retry_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('max_retries', sa.Integer, nullable=False, server_default='3'),
        sa.Column('download_speed_mbps', sa.Float, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now())
    )
    
    # Add foreign key constraints
    op.create_foreign_key(
        'fk_content_distribution_content',
        'content_distribution', 'content',
        ['content_id'], ['id'],
        ondelete='CASCADE'
    )
    
    op.create_foreign_key(
        'fk_content_distribution_player',
        'content_distribution', 'player',
        ['player_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Add location_id column to player table
    op.add_column('player', sa.Column('location_id', sa.String(36), nullable=True))
    op.add_column('player', sa.Column('room_name', sa.String(50), nullable=True))
    op.add_column('player', sa.Column('network_speed_mbps', sa.Float, nullable=True))
    op.add_column('player', sa.Column('storage_capacity_gb', sa.Float, nullable=False, server_default='50.0'))
    op.add_column('player', sa.Column('storage_used_gb', sa.Float, nullable=False, server_default='0.0'))
    op.add_column('player', sa.Column('cache_size_gb', sa.Float, nullable=False, server_default='0.0'))
    op.add_column('player', sa.Column('uptime_hours', sa.Float, nullable=False, server_default='0.0'))
    op.add_column('player', sa.Column('avg_download_speed_mbps', sa.Float, nullable=True))
    
    # Add foreign key for location
    op.create_foreign_key(
        'fk_player_location',
        'player', 'location',
        ['location_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Create indexes for better performance
    op.create_index('idx_content_distribution_status', 'content_distribution', ['status'])
    op.create_index('idx_content_distribution_player', 'content_distribution', ['player_id'])
    op.create_index('idx_content_distribution_content', 'content_distribution', ['content_id'])
    op.create_index('idx_content_distribution_created', 'content_distribution', ['created_at'])
    op.create_index('idx_player_location', 'player', ['location_id'])
    op.create_index('idx_location_active', 'location', ['is_active'])

def downgrade():
    """Rollback migration changes"""
    
    # Drop indexes
    op.drop_index('idx_location_active', 'location')
    op.drop_index('idx_player_location', 'player')
    op.drop_index('idx_content_distribution_created', 'content_distribution')
    op.drop_index('idx_content_distribution_content', 'content_distribution')
    op.drop_index('idx_content_distribution_player', 'content_distribution')
    op.drop_index('idx_content_distribution_status', 'content_distribution')
    
    # Drop foreign key constraints
    op.drop_constraint('fk_player_location', 'player', type_='foreignkey')
    op.drop_constraint('fk_content_distribution_player', 'content_distribution', type_='foreignkey')
    op.drop_constraint('fk_content_distribution_content', 'content_distribution', type_='foreignkey')
    
    # Remove columns from player table
    op.drop_column('player', 'avg_download_speed_mbps')
    op.drop_column('player', 'uptime_hours')
    op.drop_column('player', 'cache_size_gb')
    op.drop_column('player', 'storage_used_gb')
    op.drop_column('player', 'storage_capacity_gb')
    op.drop_column('player', 'network_speed_mbps')
    op.drop_column('player', 'room_name')
    op.drop_column('player', 'location_id')
    
    # Drop tables
    op.drop_table('content_distribution')
    op.drop_table('location')
