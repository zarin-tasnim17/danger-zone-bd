module.exports = {
  apps: [
    {
      name: 'danger-zone-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '450M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
