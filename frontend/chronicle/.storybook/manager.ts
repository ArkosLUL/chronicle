// Relay tweakcn messages between parent (tweakcn.com) and story iframe
function getStoryIframe(): HTMLIFrameElement | null {
  return document.getElementById('storybook-preview-iframe') as HTMLIFrameElement;
}

function sendToParent(data: unknown) {
  if (window.parent !== window) {
    window.parent.postMessage(data, '*');
  }
}

function sendToStory(data: unknown) {
  const iframe = getStoryIframe();
  iframe?.contentWindow?.postMessage(data, '*');
}

window.addEventListener('message', (e) => {
  const type = e.data?.type;
  if (!type?.startsWith('TWEAKCN_')) return;

  // Message from parent (tweakcn) -> forward to story
  if (e.source === window.parent) {
    console.log('[storybook manager] forwarding to story:', type);
    sendToStory(e.data);
  }
  // Message from story iframe -> forward to parent
  else if (e.source === getStoryIframe()?.contentWindow) {
    console.log('[storybook manager] forwarding to parent:', type);
    sendToParent(e.data);
  }
});

console.log('[storybook manager] tweakcn relay loaded');
