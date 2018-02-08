import * as utils from './utils';

export default function EventProcessor(eventsUrl, eventSerializer) {
  const processor = {};
  const queue = [];
  let initialFlush = true;

  processor.enqueue = function(event) {
    queue.push(event);
  };

  processor.flush = function(user, sync) {
    let maxLength = 2000 - eventsUrl.length;
    let data = [];

    if (!user) {
      if (initialFlush) {
        if (console) {
          if (console.warn) {
            console.warn(
              'Be sure to call `identify` in the LaunchDarkly client: http://docs.launchdarkly.com/docs/running-an-ab-test#include-the-client-side-snippet'
            );
          }
        }
      }
      return false;
    }

    initialFlush = false;
    while (maxLength > 0 && queue.length > 0) {
      const event = queue.pop();
      event.user = user;
      maxLength -= utils.base64URLEncode(JSON.stringify(event)).length;
      // If we are over the max size, put this one back on the queue
      // to try in the next round, unless this event alone is larger
      // than the limit, in which case, screw it, and try it anyway.
      if (maxLength < 0 && data.length > 0) {
        queue.push(event);
      } else {
        data.push(event);
      }
    }

    if (data.length > 0) {
      data = eventSerializer.serialize_events(data);
      const src = eventsUrl + '?d=' + utils.base64URLEncode(JSON.stringify(data));
      // Detect browser support for CORS
      if ('withCredentials' in new XMLHttpRequest()) {
        /* Supports cross-domain requests */
        const xhr = new XMLHttpRequest();
        xhr.open('GET', src, !sync);
        xhr.send();
      } else {
        const img = new Image();
        img.src = src;
      }
    }

    // If the queue is not empty, call settimeout to flush it again
    // with a 0 timeout (stack-less recursion)
    // Or, just recursively call flush_queue with the remaining elements
    // if we're doing this on unload
    if (queue.length > 0) {
      if (sync) {
        processor.flush(user, sync);
      } else {
        setTimeout(() => {
          processor.flush(user);
        }, 0);
      }
    }
    return false;
  };

  return processor;
}
