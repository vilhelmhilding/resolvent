.PHONY: dev stop logs restart

dev: stop
	@if command -v pm2 >/dev/null 2>&1; then \
		echo "Starting via pm2..."; \
		pm2 start ecosystem.config.js && pm2 save; \
	else \
		echo "pm2 not found, starting directly (install pm2 for background mode)..."; \
		(cd backend && mamba run -n main python main.py) & \
		(cd frontend && npm run dev) & \
	fi
	@echo "Backend: http://localhost:8000  |  Frontend: http://localhost:3000"

stop:
	@pm2 stop resolvent-backend resolvent-frontend 2>/dev/null || true
	@pm2 delete resolvent-backend resolvent-frontend 2>/dev/null || true
	@lsof -ti :8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true
	@echo "Stopped."

restart:
	@pm2 restart resolvent-backend resolvent-frontend

logs:
	@pm2 logs
