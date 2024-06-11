import 'dart:async';
import 'dart:io';

import 'package:server/types.dart';

Future<String?> getNetworkIpAddress() async {
  final interfaces = await NetworkInterface.list(
      type: InternetAddressType.IPv4, includeLinkLocal: true);
  List<InternetAddress> ipList = [];
  for (var e in interfaces) {
    ipList.addAll(e.addresses);
  }
  var address = ipList.where((e) => e.address.startsWith("192.")).firstOrNull;
  return address?.address;
}

class FileServer {
  final List<FileServerConnection> _connections = [];
  List<FileServerConnection> get connections => _connections;

  final List<FileServerRequest> _requests = [];
  List<FileServerRequest> get requests => _requests;

  void add(FileServerConnection c) {
    if (_connections.indexWhere((e) => e.id == c.id) == -1) {
      _connections.add(c);
      broadcast(FileServerSocketMsg(joined: {
        "id": c.id,
        "name": c.name,
        "stat": true,
      }));
      print("connected: ${c.id} --> ${c.name}");
    }
  }

  void remove(String id, String name, {dynamic err}) {
    _connections.removeWhere((e) => e.id == id);
    broadcast(FileServerSocketMsg(joined: {
      "id": id,
      "name": name,
      "stat": false,
    }));
    if (err == null) {
      print("closed connection: $id --> $name");
    } else {
      print("failed connection: $id --> $name, ${err.toString()}");
    }
  }

  void broadcast(FileServerSocketMsg msg) async {
    for (var c in _connections) {
      c.socket.sink.add(msg.toString());
    }
  }

  void addRequest(FileServerRequest req) {
    _requests.add(req);
  }

  void removeRequest(String rid) {
    _requests.removeWhere((r) => r.rid == rid);
  }

  Future<FileServerRequest?> onRequest(String rid) async {
    var i = 0;
    while (true) {
      var req = _requests.where((r) => r.rid == rid).firstOrNull;
      if (req != null) return req;
      if (i == 20) return null;
      await Future.delayed(const Duration(milliseconds: 500), () => i++);
    }
  }

  Future<void> onRequestRemove(String rid) async {
    var i = 0;
    while (true) {
      if (_requests.where((r) => r.rid == rid).isEmpty) return;
      if (i == 100) {
        return removeRequest(rid);
      }
      await Future.delayed(const Duration(milliseconds: 10000), () => i++);
    }
  }
}
