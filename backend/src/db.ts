import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS senders (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INT NOT NULL,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS slack_connections (
      user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      webhook_url TEXT NOT NULL,
      team_name TEXT,
      channel TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      sender_id INT NOT NULL REFERENCES senders(id),
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | processing | sent | failed
      hourly_limit INT,
      preview_url TEXT,
      error TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS emails_user_status ON emails(user_id, status, scheduled_at);
  `);
}
