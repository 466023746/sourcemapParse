/**
 * Created by loutao on 2017/9/20.
 */

const sourceMap = require('source-map');
const http = require('http');
const https = require('https');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const EventEmitter = require('events');
const fs = require('fs');
const net = require('net');

// let arg = process.argv[2];
//
// parse(arg).then(result => {
//     console.log(result);
// });

let config = require('./config');
let matchUrl = config.matchUrl;
let port = config.port;

var httpServer = http.createServer((req, res) => {
    var reqChunk = [], reqChunkLen = 0;

    req.on('data', function (chunk) {
        reqChunk.push(chunk);
        reqChunkLen += chunk.length;
    });

    req.on('end', function () {
        var body = Buffer.concat(reqChunk, reqChunkLen);
        var requestUrl = req.url;
        var urlObj = url.parse(requestUrl);
        var options = {
            host: urlObj.hostname,
            port: urlObj.port,
            method: req.method,
            path: urlObj.path,
            headers: req.headers
        };

        _request(options, body, function (err, data, obj) {
            var header = obj.headers || {};

            if (err) {
                res.writeHead(obj.statusCode || 400, header);
                res.end();
            } else {
                res.writeHead(obj.statusCode, header);

                var needParse = matchUrl.some(item => {
                    return options.path.indexOf(item) > -1
                });
                if (needParse) {
                    data = data.toString();
                    data = JSON.parse(data);

                    if (data && data.responses) {
                        console.log('intercept request', requestUrl);

                        var count = 0;
                        var totalCount = 0;
                        let notWrite = true;

                        data.responses.forEach((item) => {
                            item.hits.hits.forEach(hit => {
                                totalCount++;
                            })
                        });

                        data.responses.forEach(item => {
                            item.hits.hits.forEach(hit => {
                                if (typeof hit['_source']['data'] == 'string') {
                                    hit['_source']['data'] = hit['_source']['data']
                                        .replace(/\\n/g, '\n')
                                        .replace(/"[,，]/g, '",\n')
                                        .replace(/{/, '{\n')
                                        .replace(/}/, '\n}');

                                    var reg = /(http|https)[\w\d\\\/:\._?=]+\.js[\w\d\\\/:\._?=]+:\d+:\d+/g;
                                    var tempArr = hit['_source']['data'].match(reg);

                                    if (tempArr) {
                                        var tempCount = 0;

                                        tempArr.forEach((item, index) => {
                                            parse(item).then(result => {
                                                if (result) {
                                                    tempArr[index] = result.source + ':' + result.line + ':' + result.column;
                                                }
                                                tempCount++;
                                                changeContent();
                                            })
                                        });

                                        function changeContent() {
                                            if (tempCount == tempArr.length) {
                                                let index = 0;

                                                hit['_source']['data'] = hit['_source']['data']
                                                    .replace(reg, () => {
                                                        let result = tempArr[index];
                                                        index++;
                                                        return result
                                                    });

                                                count++;
                                                check();
                                            }
                                        }

                                    } else {
                                        count++;
                                        check();
                                    }
                                } else {
                                    count++;
                                    check();
                                }
                            })
                        });

                        check();

                        function check() {
                            if (count == totalCount && notWrite) {
                                notWrite = false;
                                data = JSON.stringify(data);
                                res.write(data);
                                res.end();
                            }
                        }

                        return
                    }
                    data = JSON.stringify(data);
                }
                console.log('proxy request', requestUrl);
                res.write(data);
                res.end();
            }
        });
    })
});

// httpServer.on('connect', function (req, socket, head) {
//     var options = {
//         port: 443
//     };
//
//     var socketProxy = new net.Socket();
//     socketProxy.connect(options, function () {
//         socket.write('HTTP/' + req.httpVersion + '200 Connection established\r\n\r\n');
//     });
//
//     socket.pipe(socketProxy);
//     socketProxy.pipe(socket);
// });
//
// var sslOptions = {
//     key: fs.readFileSync('./challenget.win.key'),
//     cert: fs.readFileSync('./2_challenget.win.crt')
// };
// var httpsServer = https.createServer(sslOptions, (req, res) => {
//     var reqChunk = [], reqChunkLen = 0;
//
//     req.on('data', function (chunk) {
//         reqChunk.push(chunk);
//         reqChunkLen += chunk.length;
//     });
//
//     req.on('end', function () {
//         var body = Buffer.concat(reqChunk, reqChunkLen);
//         var requestUrl = req.url;
//         var urlObj = url.parse(requestUrl);
//         var options = {
//             host: urlObj.hostname,
//             port: urlObj.port,
//             method: req.method,
//             path: urlObj.path,
//             headers: req.headers
//         };
//
//         _request(options, body, function (err, data, obj) {
//             var header = obj.headers || {};
//
//             if (err) {
//                 res.writeHead(obj.statusCode || 400, header);
//                 res.end();
//             } else {
//                 res.writeHead(obj.statusCode, header);
//
//                 var needParse = matchUrl.some(item => {
//                     return options.path.indexOf(item) > -1
//                 });
//                 if (needParse) {
//                     data = data.toString();
//                     data = JSON.parse(data);
//
//                     if (data && data.responses) {
//                         console.log('intercept request', requestUrl);
//
//                         var count = 0;
//                         var totalCount = 0;
//                         let notWrite = true;
//
//                         data.responses.forEach((item) => {
//                             item.hits.hits.forEach(hit => {
//                                 totalCount++;
//                             })
//                         });
//
//                         data.responses.forEach(item => {
//                             item.hits.hits.forEach(hit => {
//                                 if (typeof hit['_source']['data'] == 'string') {
//                                     hit['_source']['data'] = hit['_source']['data']
//                                         .replace(/\\n/g, '\n')
//                                         .replace(/"[,，]/g, '",\n')
//                                         .replace(/{/, '{\n')
//                                         .replace(/}/, '\n}');
//
//                                     var reg = /(http|https)[\w\d\\\/:\._?=]+\.js[\w\d\\\/:\._?=]+:\d+:\d+/g;
//                                     var tempArr = hit['_source']['data'].match(reg);
//
//                                     if (tempArr) {
//                                         var tempCount = 0;
//
//                                         tempArr.forEach((item, index) => {
//                                             parse(item).then(result => {
//                                                 if (result) {
//                                                     tempArr[index] = result.source + ':' + result.line + ':' + result.column;
//                                                 }
//                                                 tempCount++;
//                                                 changeContent();
//                                             });
//                                         });
//
//                                         function changeContent() {
//                                             if (tempCount == tempArr.length) {
//                                                 let index = 0;
//
//                                                 hit['_source']['data'] = hit['_source']['data']
//                                                     .replace(reg, () => {
//                                                         let result = tempArr[index];
//                                                         index++;
//                                                         return result
//                                                     });
//
//                                                 count++;
//                                                 check();
//                                             }
//                                         }
//
//                                     } else {
//                                         count++;
//                                         check();
//                                     }
//                                 } else {
//                                     count++;
//                                     check();
//                                 }
//                             })
//                         });
//
//                         check();
//
//                         function check() {
//                             if (count == totalCount && notWrite) {
//                                 notWrite = false;
//                                 data = JSON.stringify(data);
//                                 res.write(data);
//                                 res.end();
//                             }
//                         }
//
//                         return
//                     }
//                     data = JSON.stringify(data);
//                 }
//                 console.log('proxy request', requestUrl);
//                 res.write(data);
//                 res.end();
//             }
//         }, true);
//     })
// });

function _request(options, body, cb, isHttps) {

    var req = (isHttps ? https : http).request(options, function (res) {
        var header = res.headers;
        var contentEncoding = header['content-encoding'];
        var list = [], len = 0;

        res.on('data', function (chunk) {
            list.push(chunk);
            len += chunk.length;
        });

        res.on('end', function () {
            var buffer = Buffer.concat(list, len);

            switch (contentEncoding) {
                case 'gzip':
                    buffer = zlib.gunzipSync(buffer);
                    delete header['content-encoding'];
                    break;
                case 'deflate':
                    buffer = zlib.inflateSync(buffer);
                    delete header['content-encoding'];
                    break;
            }
            header['content-length'] = buffer.length;

            cb(null, buffer, res);
        });

        res.on('error', function (err) {
            console.log('response error', err);
            cb(err, null, res);
        })
    });

    req.on('error', function (err) {
        console.log('request error', err);
        if (err.message == 'socket hang up') req.abort();
        cb(err, null, req);
    });

    if (body) {
        req.write(body);
    }
    req.end();
}

let cache = {};
let eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(0);

function parse(str) {
    let p = new Promise((resolve, reject) => {
        let result = str.split(':');
        let file = result[0] + ':' + result[1];
        let line = +result[2];
        let column = +result[3];
        // has port
        if (result.length == 5) {
            file += ':' + result[2];
            line = +result[3];
            column = +result[4];
        }
        let result2 = file.split('?');
        let sourceFile = result2[0] + '.map?' + result2[1];
        sourceFile = sourceFile.replace(/\\/g, '')
            .replace(/\/j\/\d+\//, '/site/js/');
// sourceFile += '?v=' + new Date().getTime();
        let eventName = 'getData-' + sourceFile;

        var cacheData = cache[formatCacheName(sourceFile, line, column)];
        if (cacheData) return resolve(cacheData);

        let cacheObj = cache[sourceFile];
        if (cacheObj) {
            if (cacheObj.data) {
                var consumer = new sourceMap.SourceMapConsumer(cacheObj.data);
                let result = consumer.originalPositionFor({
                    line,
                    column
                });
                cache[formatCacheName(sourceFile, line, column)] = result;
                return resolve(result)
            } else if (cacheObj.requesting) {
                return eventEmitter.once(eventName, (data) => {
                    if (data) {
                        var cacheData = cache[formatCacheName(sourceFile, line, column)];
                        if (cacheData) return resolve(cacheData);

                        var consumer = new sourceMap.SourceMapConsumer(data);
                        let result = consumer.originalPositionFor({
                            line,
                            column
                        });
                        cache[formatCacheName(sourceFile, line, column)] = result;
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                })
            } else if (cacheObj.notNeedParse) {
                resolve(null);
            }
        }

        cache[sourceFile] = {
            requesting: true
        };

        let urlObject = url.parse(sourceFile);
        let options = {
            hostname: urlObject.hostname,
            port: urlObject.port,
            path: urlObject.path
        };

        let req = http.request(options, (res) => {

            let chunkData = [], chunkLen = 0;

            res.on('data', chunk => {
                chunkData.push(chunk);
                chunkLen += chunk.length;
            });

            res.on('end', () => {
                let chunk = Buffer.concat(chunkData, chunkLen);
                let data = chunk.toString();
                try {
                    data = JSON.parse(data);
                } catch (err) {
                    console.log('json parse error', sourceFile);
                    data = null;
                    cache[sourceFile] = {
                        data,
                        requesting: false,
                        notNeedParse: true
                    };
                    cache[formatCacheName(sourceFile, line, column)] = null;
                    resolve(data);
                    return eventEmitter.emit(eventName, null);
                }
                var consumer = new sourceMap.SourceMapConsumer(data);
                let result = consumer.originalPositionFor({
                    line,
                    column
                });
                cache[sourceFile] = {
                    data,
                    requesting: false
                };
                cache[formatCacheName(sourceFile, line, column)] = result;
                resolve(result);
                eventEmitter.emit(eventName, data);
            })
        });

        req.on('error', (err) => {
            console.log('request error', err);
            if (err.message == 'socket hang up') req.abort();
            let data = null;
            cache[sourceFile] = {
                data,
                requesting: false,
                notNeedParse: true
            };
            cache[formatCacheName(sourceFile, line, column)] = null;
            resolve(data);
            return eventEmitter.emit(eventName, null);
        });

        req.end();
    });

    return p
}

function formatCacheName(sourceFile, line, column) {
    return sourceFile + '-' + line + '-' + column
}

process.on('uncaughtException', function (err) {
    console.log('process error', err);
});

httpServer.listen(port, function () {
    console.log('http server listen on %d', port)
});

// httpsServer.listen(443, function () {
//     console.log('https server listen on %d', 443)
// });




