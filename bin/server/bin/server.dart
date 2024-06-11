import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:server/types.dart';
import 'package:server/utils.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf_multipart/form_data.dart';
import 'package:shelf_multipart/multipart.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_web_socket/shelf_web_socket.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

Router router = Router();
FileServer _fileServer = FileServer();

Map<String, String> _defaultHeaders = {"Access-Control-Allow-Origin": "*"};

void main() async {
  var port = Random().nextInt(10000) + 5000;
  var netIp = await getNetworkIpAddress();
  var info = {
    "net": netIp == null ? null : 'http://${netIp}:$port/',
    "local": 'http://127.0.0.1:$port/',
  };
  // create server routes
  router.get("/connect", _socketHandler);
  router.post("/upload", _fileUploadHandler);
  router.get("/file", _fileDownloadHandler);
  router.get("/stat", (_) => Response.ok(json.encode({"ok": true})));
  // create server
  // ignore: implicit_call_tearoffs
  var handler = Pipeline().addMiddleware(_fixCORS).addHandler(router);
  (await shelf_io.serve(handler, '0.0.0.0', port)).autoCompress = true;
  // print info
  print(json.encode(info));
}

Middleware _fixCORS = createMiddleware(
  requestHandler: (req) => (req.method == 'OPTIONS')
      ? Response.ok(null, headers: _defaultHeaders)
      : null,
  responseHandler: (resp) => resp.change(headers: _defaultHeaders),
);

Future<Response> _socketHandler(Request request) async {
  try {
    Uri reqUrl = request.requestedUri;
    var id = reqUrl.queryParameters["id"];
    var name = reqUrl.queryParameters["name"];
    if (id == null) return Response.badRequest(body: "id not found");
    if (name == null) return Response.badRequest(body: "name not found");

    return webSocketHandler((WebSocketChannel socket) {
      socket.stream.listen(
        (data) async {
          var msg = FileServerSocketMsg.fromJson(json.decode(data));
          if (msg.ping == true) {
            _fileServer.add(
              FileServerConnection(id: id, name: name, socket: socket),
            );
          } else {
            msg.id = id;
            msg.name = name;
            _fileServer.broadcast(msg);
          }
        },
        onDone: () => _fileServer.remove(id, name),
        onError: (err) => _fileServer.remove(id, name, err: err),
        cancelOnError: true,
      );
      print("connection request: $id --> $name");
      socket.sink.add(FileServerSocketMsg(ping: true).toString());
    })(request);
  } catch (e) {
    return Response.internalServerError(body: e.toString());
  }
}

Future<Response> _fileUploadHandler(Request request) async {
  try {
    var rid = request.requestedUri.queryParameters["rid"];
    if (rid == null) return Response.badRequest(body: "rid not found");
    // add the request to the list of requests
    _fileServer.addRequest(FileServerRequest(rid: rid, req: request));
    // wait the the receiver to consume the request
    await _fileServer.onRequestRemove(rid);
    print("sent file request: $rid");
    return Response.ok(json.encode({"ok": true}));
  } catch (e) {
    return Response.internalServerError(body: e.toString());
  }
}

Future<Response> _fileDownloadHandler(Request request) async {
  try {
    var id = request.requestedUri.queryParameters["id"];
    var rid = request.requestedUri.queryParameters["rid"];
    var name = request.requestedUri.queryParameters["name"];
    var size = request.requestedUri.queryParameters["size"];
    if (rid == null || id == null || name == null || size == null) {
      return Response.badRequest(body: "queries not found");
    }
    // notify sender that a connection wants the file
    _fileServer
        .broadcast(FileServerSocketMsg(id: id, fileRID: rid, file: name));
    // wait for the sender's file upload request
    var filereq = await _fileServer.onRequest(rid);
    // return the request stream
    if (filereq != null &&
        filereq.req.isMultipart &&
        filereq.req.isMultipartForm) {
      await for (final data in filereq.req.multipartFormData) {
        if (data.filename != null) {
          print("received file request: $rid");
          var stream =
              readStream(data.part, () => _fileServer.removeRequest(rid));
          return Response.ok(stream, headers: {
            ..._defaultHeaders,
            "Content-Disposition": 'attachment; filename="${data.filename}"',
            "Content-Length": size,
          });
        }
      }
    }
    // failed to get file request
    print("didn't receive file request: $rid");
    return Response.notFound("file not found");
  } catch (e) {
    return Response.internalServerError(body: e.toString());
  }
}

Stream<List<int>> readStream(
    Stream<List<int>> stream, void Function() onDone) async* {
  await for (final chunk in stream) {
    yield chunk;
  }
  onDone();
}
