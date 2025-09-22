import url from 'url';
import http from 'http';

const PREFIX_FROM = 'http://localhost:4000/images';
const PREFIX_TO = 'https://apheleia.classics.ox.ac.uk/iipsrv/iipsrv.fcgi?IIIF=';

// PORT is the port from PREFIX_FROM string or 80 if not mentioned
const PORT = (new URL(PREFIX_FROM).port || '80');

const server = http.createServer((req, res) => {
  let fullUrl = new URL(req.url, PREFIX_FROM);

  console.log(fullUrl.href);

  if (fullUrl.href.startsWith(PREFIX_FROM)) {
    const newPath = fullUrl.pathname.slice(PREFIX_FROM.length);
    const redirectUrl = new URL(newPath, PREFIX_TO);

    console.log(`Redirecting to ${redirectUrl.href}`);

    const options = {
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(redirectUrl.href, options, (proxyRes) => {
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
