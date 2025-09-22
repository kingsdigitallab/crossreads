import url from 'url';
import http from 'http';

const PREFIX_FROM = 'http://localhost:4000/images';
const PREFIX_TO = 'https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=';

// PORT is the port from PREFIX_FROM string or 80 if not mentioned
const PORT = (new URL(PREFIX_FROM).port || '80');

const server = http.createServer((req, res) => {
  let url = req.url;

  console.log(url)

  if (url.startsWith(PREFIX_FROM)) {
    url = PREFIX_TO + url.slice(PREFIX_FROM.length);
    console.log(`Redirecting to ${url}`);

    const options = {
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(url, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    req.pipe(proxyReq, { end: true });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
