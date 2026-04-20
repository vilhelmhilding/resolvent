module.exports = {
  apps: [
    {
      name: 'resolvent-backend',
      command: 'mamba',
      args: 'run -n main python main.py',
      cwd: './backend',
      restart_delay: 2000,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'resolvent-frontend',
      command: 'npm',
      args: 'run dev',
      cwd: './frontend',
      restart_delay: 2000,
      max_restarts: 10,
    },
  ],
}
