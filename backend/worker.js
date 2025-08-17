// Cloudflare Worker entry point for API
// Will be updated with authentication, D1 integration, and endpoints
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  return new Response('API coming soon', { status: 200 });
}
