export function prepareCloudflareButton(repositoryUrl: string, format: 'markdown' | 'html' | 'url'): string {
    const url = `https://deploy.workers.cloudflare.com/?url=${repositoryUrl}`;
    if (format === 'markdown') {
        return `[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](${url})`;
    } else if (format === 'html') {
        return `<a href="${url}"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Workers" /></a>`;
    } else {
        return url;
    }
}
