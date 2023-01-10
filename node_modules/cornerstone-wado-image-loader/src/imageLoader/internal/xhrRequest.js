import external from '../../externalModules.js';
import { getOptions } from './options.js';

function _axiosRequest(url, imageId, defaultHeaders = {}, params = {}) {
  const authorizedAxiosClient = window.authorizedAxiosClient;
  const { cornerstone } = external;
  const options = getOptions();

  const errorInterceptor = (xhr) => {
    if (typeof options.errorInterceptor === 'function') {
      const error = new Error('request failed');

      error.request = xhr;
      error.response = xhr.response;
      error.status = xhr.status;
      options.errorInterceptor(error);
    }
  };

  const beforeSendHeaders = options.beforeSend(
    new XMLHttpRequest(),
    imageId,
    defaultHeaders,
    params
  );

  const headers = {};
  const mergedHeaders = Object.assign({}, defaultHeaders, beforeSendHeaders);

  Object.keys(mergedHeaders).forEach(function (key) {
    if (mergedHeaders[key] === null) {
      return;
    }
    if (key === 'Accept' && url.indexOf('accept=') !== -1) {
      return;
    }
    headers[key] = mergedHeaders[key];
  });

  return new Promise((resolve, reject) => {
    const axiosOptions = {
      method: 'GET',
      url,
      headers,
      responseType: 'arraybuffer',
      onDownloadProgress: (oProgress) => {
        const loaded = oProgress.loaded; // evt.loaded the bytes browser receive

        let total;

        let percentComplete;

        if (oProgress.lengthComputable) {
          total = oProgress.total; // evt.total the total bytes seted by the header
          percentComplete = Math.round((loaded / total) * 100);
        }

        // Action
        if (options.onprogress) {
          options.onprogress(oProgress, params);
        }

        // Event
        const eventData = {
          url,
          imageId,
          loaded,
          total,
          percentComplete,
        };

        cornerstone.triggerEvent(
          cornerstone.events,
          cornerstone.EVENTS.IMAGE_LOAD_PROGRESS,
          eventData
        );
      },
    };

    params.deferred = {
      resolve,
      reject,
    };
    params.url = url;
    params.imageId = imageId;

    if (options.onloadstart) {
      options.onloadstart(
        {
          lengthComputable: false,
          loaded: 0,
          target: null,
          total: 100,
        },
        params
      );
    }

    const eventData = {
      url,
      imageId,
    };

    cornerstone.triggerEvent(
      cornerstone.events,
      'cornerstoneimageloadstart',
      eventData
    );

    authorizedAxiosClient
      .request(axiosOptions)
      .then(({ data }) => {
        if (options.onloadend) {
          options.onloadend(
            {
              lengthComputable: false,
              loaded: 100,
              target: null,
              total: 100,
            },
            params
          );
        }
        resolve(data || []);
      })
      .catch((error) => {
        errorInterceptor(error);
        reject(error);
      });
  });
}

function _xhrRequest(url, imageId, defaultHeaders = {}, params = {}) {
  const { cornerstone } = external;
  const options = getOptions();

  const errorInterceptor = (xhr) => {
    if (typeof options.errorInterceptor === 'function') {
      const error = new Error('request failed');

      error.request = xhr;
      error.response = xhr.response;
      error.status = xhr.status;
      options.errorInterceptor(error);
    }
  };

  // Make the request for the DICOM P10 SOP Instance
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('get', url, true);
    const beforeSendHeaders = options.beforeSend(
      xhr,
      imageId,
      defaultHeaders,
      params
    );

    xhr.responseType = 'arraybuffer';

    const headers = Object.assign({}, defaultHeaders, beforeSendHeaders);

    Object.keys(headers).forEach(function (key) {
      if (headers[key] === null) {
        return;
      }
      if (key === 'Accept' && url.indexOf('accept=') !== -1) {
        return;
      }
      xhr.setRequestHeader(key, headers[key]);
    });

    params.deferred = {
      resolve,
      reject,
    };
    params.url = url;
    params.imageId = imageId;

    // Event triggered when downloading an image starts
    xhr.onloadstart = function (event) {
      // Action
      if (options.onloadstart) {
        options.onloadstart(event, params);
      }

      // Event
      const eventData = {
        url,
        imageId,
      };

      cornerstone.triggerEvent(
        cornerstone.events,
        'cornerstoneimageloadstart',
        eventData
      );
    };

    // Event triggered when downloading an image ends
    xhr.onloadend = function (event) {
      // Action
      if (options.onloadend) {
        options.onloadend(event, params);
      }

      const eventData = {
        url,
        imageId,
      };

      // Event
      cornerstone.triggerEvent(
        cornerstone.events,
        'cornerstoneimageloadend',
        eventData
      );
    };

    // handle response data
    xhr.onreadystatechange = function (event) {
      // Action
      if (options.onreadystatechange) {
        options.onreadystatechange(event, params);

        return;
      }

      // Default action
      // TODO: consider sending out progress messages here as we receive
      // the pixel data
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          options
            .beforeProcessing(xhr)
            .then(resolve)
            .catch(() => {
              errorInterceptor(xhr);
              // request failed, reject the Promise
              reject(xhr);
            });
        } else {
          errorInterceptor(xhr);
          // request failed, reject the Promise
          reject(xhr);
        }
      }
    };

    // Event triggered when downloading an image progresses
    xhr.onprogress = function (oProgress) {
      // console.log('progress:',oProgress)
      const loaded = oProgress.loaded; // evt.loaded the bytes browser receive

      let total;

      let percentComplete;

      if (oProgress.lengthComputable) {
        total = oProgress.total; // evt.total the total bytes seted by the header
        percentComplete = Math.round((loaded / total) * 100);
      }

      // Action
      if (options.onprogress) {
        options.onprogress(oProgress, params);
      }

      // Event
      const eventData = {
        url,
        imageId,
        loaded,
        total,
        percentComplete,
      };

      cornerstone.triggerEvent(
        cornerstone.events,
        cornerstone.EVENTS.IMAGE_LOAD_PROGRESS,
        eventData
      );
    };
    xhr.onerror = function () {
      errorInterceptor(xhr);
      reject(xhr);
    };

    xhr.onabort = function () {
      errorInterceptor(xhr);
      reject(xhr);
    };
    xhr.send();
  });
}

function xhrRequest(url, imageId, defaultHeaders = {}, params = {}) {
  const authorizedAxiosClient = window.authorizedAxiosClient;

  return authorizedAxiosClient
    ? _axiosRequest(url, imageId, defaultHeaders, params)
    : _xhrRequest(url, imageId, defaultHeaders, params);
}

export default xhrRequest;
