import {
  DenoIO,
  GLTF,
  JSONDocument,
} from "https://esm.sh/@gltf-transform/core";
import * as path from "https://deno.land/std/path/mod.ts";
import { MeshBuffer } from "./MeshBuffer.ts";

export type id = string;
export type idParent = string;
export type fullname = string;

export class Parser {
  public filepath!: string;
  public document!: JSONDocument;
  public scenes!: GLTF.IScene[];
  public nodes!: GLTF.INode[];
  public meshes!: GLTF.IMesh[];
  public bufferViews!: GLTF.IBufferView[];
  public accessors!: GLTF.IAccessor[];
  public binBuffer!: Uint8Array;
  public id2Parent = new Map<id, idParent>();
  public id2Fullname = new Map<id, fullname>();
  public meshBuffer = new Map<id, MeshBuffer>();
  public filename!: string;
  public exportFilderPath!: string;

  public async parse(filepath: string, filename:string, exportFilderPath:string) {
    this.filepath = filepath;
    this.filename = filename
    this.exportFilderPath = exportFilderPath;
    const io = new DenoIO(path);
    this.document = await io.readAsJSON(this.filepath);
    if (this.document) {
      this.scenes = this.document.json.scenes || [];
      this.nodes = this.document.json.nodes || [];
      this.meshes = this.document.json.meshes || [];
      this.accessors = this.document.json.accessors || [];
      this.bufferViews = this.document.json.bufferViews || [];
      this.binBuffer = this.document?.resources["@glb.bin"] || new Uint8Array();
      this.parseScenes();
    }
  }

  private parseScenes() {
    this.scenes.forEach((scene) => {
      this.parseNodes("*", scene.nodes, null);
    });

    console.log("writing file", this.filepath)

    const materials = Array.from(this.meshBuffer.keys());
    materials.forEach(async (materialid, i) => {
      const mat = this.meshBuffer.get(materialid);
      if (mat) {
        console.log("material:", materialid);
        console.log((new Uint32Array(mat.indexBuffer).length * 4) / 1000000);
        console.log(
          (new Float32Array(mat.positionBuffer).length * 4) / 1000000
        );
        if (mat) {
          mat.cleanAll(); 
          console.log((mat.index.length * 4) / 1000000);
          console.log((mat.position.length * 4) / 1000000);

          await Deno.writeFile(
            this.exportFilderPath + this.filename + "index" + i+ ".bin",
            new Uint8Array(mat.index.buffer)
          );
          await Deno.writeFile(
            this.exportFilderPath + this.filename + "position" + i + ".bin",
            new Uint8Array(mat.position.buffer)
          );
        }
      }
    });
  }

  private parseNodes(parentId: string, nodes: number[], matrix:any) {
    nodes.forEach((number) => {
      const node = this.nodes[number];
      this.parseNode(parentId, node, matrix);
    });
  }

  private parseNode(parentId: string, node: GLTF.INode, $matrix: number[] | null) {
    const nodeId = this.UUID();
    const matrix = node.matrix || $matrix

    if (node.name) {
      this.id2Parent.set(nodeId, parentId);
      this.id2Fullname.set(nodeId, node.name);
    }
    if (Array.isArray(node.children)) {
      this.parseNodes(nodeId, node.children, matrix);
    }
    if (node.mesh) {
      const primitives = this.meshes[node.mesh]?.primitives[0];
      this.id2Parent.set(nodeId, parentId);
      if (primitives && primitives.attributes) {
        const material = primitives.material as number;
        const position = primitives.attributes.POSITION;
        const index = primitives.indices as number;
        if (
          material !== undefined &&
          index !== undefined &&
          position !== undefined
        )
          this.parseMesh(
            nodeId,
            material,
            index,
            position,
            matrix || null
          );
      }
    }
  }

  private parseMesh(
    nodeid: string,
    material: number,
    index: number,
    position: number,
    matrix: number[] | null
  ) {
    if (!this.meshBuffer.has(material.toString())) {
      this.meshBuffer.set(material.toString(), new MeshBuffer(material, this));
    }
    const meshBuffer = this.meshBuffer.get(material.toString()) as MeshBuffer;
    meshBuffer.addMesh(nodeid, index, position, matrix);
  }

  private UUID() {
    return crypto.randomUUID();
  }
}
