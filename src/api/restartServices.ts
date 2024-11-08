import { execa } from 'execa';
import { RestartStatus } from './responses.js';

export async function restartServices(): Promise<RestartStatus> {
    try {
        restartDatabase()
        await execa('sudo', [
                'service', 'nginx', 'restart',
                '&&', 'service', 'blockchain-app', 'restart'
            ], {
            stdio: 'inherit',
            });
        console.log('Blockchain app and Nginx restarted successfully.');
        return {
            services: "nginx,database,blockchain-app",
            status: "restarted"
        };
    }
    catch (error) {
      console.error("Error restarting services:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to restart services: ${error.message}`);
      } else {
        throw new Error("Failed to restart services: Unknown error");
      }
    }
}

export async function restartDatabase(): Promise<RestartStatus> {
    try {
        await execa('sudo', ['service', 'clickhouse-server', 'restart'], {
            stdio: 'inherit',
            });
        await execa('sudo', ['service', 'clickhouse-keeper', 'restart'], {
            stdio: 'inherit',
            });
        console.log('Database restarted successfully');
        return {
            services: "database",
            status: "restarted"
        };
    }
    catch (error) {
      console.error("Error restarting database:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to restart database: ${error.message}`);
      } else {
        throw new Error("Failed to restart database: Unknown error");
      }
    }
}
