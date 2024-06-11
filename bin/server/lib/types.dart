import 'dart:convert';

import 'package:shelf/shelf.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class FileServerRequest {
  final String rid;
  final Request req;
  FileServerRequest({
    required this.rid,
    required this.req,
  });
}

class FileServerConnection {
  final String id;
  final String name;
  final WebSocketChannel socket;
  FileServerConnection({
    required this.id,
    required this.name,
    required this.socket,
  });
  toJson() {
    return {
      "id": id,
      "name": name,
    };
  }
}

class FileServerSocketMsg {
  final bool? ping;
  final String? mid;
  final String? text;
  final String? file;
  final int? fileSize;
  final String? fileRID;
  final Map<String, dynamic>? joined;
  String? name;
  String? id;
  FileServerSocketMsg({
    this.ping,
    this.text,
    this.file,
    this.fileSize,
    this.fileRID,
    this.joined,
    this.name,
    this.mid,
    this.id,
  });
  factory FileServerSocketMsg.fromJson(Map<String, dynamic> json) {
    return FileServerSocketMsg(
      ping: json["ping"],
      text: json["text"],
      file: json["file"],
      fileSize: json["fileSize"],
      fileRID: json["fileRID"],
      name: json["name"],
      mid: json["mid"],
      id: json["id"],
    );
  }
  @override
  String toString() {
    return json.encode({
      "ping": ping,
      "text": text,
      "file": file,
      "fileSize": fileSize,
      "fileRID": fileRID,
      "joined": joined,
      "name": name,
      "mid": mid,
      "id": id,
    });
  }
}
