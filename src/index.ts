import * as core from '@actions/core';
import { GlueClient, StartCrawlerCommand, GetCrawlerCommand, GetCrawlerMetricsCommand } from '@aws-sdk/client-glue';

async function run(): Promise<void> {
  try {
    // Get inputs
    const crawlerName = core.getInput('crawler-name', { required: true });
    const waitForCompletion = core.getInput('wait-for-completion') === 'true';
    const timeoutMinutes = parseInt(core.getInput('timeout-minutes') || '60', 10);
    // Note: catalogId is available but not currently used by this action
    // const catalogId = core.getInput('catalog-id') || undefined;

    // Initialize Glue client
    const glue = new GlueClient({});

    // Start the crawler
    core.info(`Starting crawler: ${crawlerName}`);
    await glue.send(
      new StartCrawlerCommand({
        Name: crawlerName,
      })
    );

    // Set initial outputs
    core.setOutput('success', 'true');

    if (waitForCompletion) {
      core.info('Waiting for crawler to complete...');
      const startTime = Date.now();
      const timeoutMs = timeoutMinutes * 60 * 1000;

      while (true) {
        const response = await glue.send(
          new GetCrawlerCommand({
            Name: crawlerName,
          })
        );

        const state = response.Crawler?.State;
        core.info(`Crawler state: ${state}`);

        if (state === 'READY') {
          core.setOutput('state', state);
          
          // Try to get metrics if available
          try {
            const metricsResponse = await glue.send(
              new GetCrawlerMetricsCommand({
                CrawlerNameList: [crawlerName],
              })
            );
            
            const metrics = metricsResponse.CrawlerMetricsList?.[0];
            core.setOutput('tables-created', metrics?.TablesCreated?.toString() || '0');
            core.setOutput('tables-updated', metrics?.TablesUpdated?.toString() || '0');
            core.setOutput('tables-deleted', metrics?.TablesDeleted?.toString() || '0');
          } catch {
            // If metrics aren't available, just use defaults
            core.warning('Could not retrieve crawler metrics');
            core.setOutput('tables-created', '0');
            core.setOutput('tables-updated', '0');
            core.setOutput('tables-deleted', '0');
          }
          
          core.info('Crawler completed successfully');
          break;
        }

        if (Date.now() - startTime > timeoutMs) {
          throw new Error(`Crawler did not complete within ${timeoutMinutes} minutes`);
        }

        // Wait 10 seconds before checking again
        await new Promise((resolve) => globalThis.setTimeout(resolve, 10000));
      }
    } else {
      core.info('Not waiting for crawler completion (wait-for-completion is false)');
      core.setOutput('state', 'RUNNING');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
    core.setOutput('success', 'false');
  }
}

run();
