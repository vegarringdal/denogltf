import { GLTF } from "https://esm.sh/@gltf-transform/core";
import { Parser } from "./Parser.ts";

export class MeshBuffer {
  indexBuffer: number[] = [];
  positionBuffer: number[] = [];
  idMap = new Map<string, { start: number; count: number }>();
  index!: Uint32Array;
  position!: Float32Array;

  constructor(private materialId: number, private parser: Parser) {}

  public addMesh(
    nodeid: string,
    index: number,
    position: number,
    matrix: number[] | null
  ) {
    const indexAccessor = this.parser.accessors[index];

    if (!indexAccessor.bufferView === undefined) {
      return;
    }

    const indexBufferView =
      this.parser.bufferViews[indexAccessor.bufferView as number];
    const indexBuffer = this.getIndex(indexBufferView, indexAccessor);

    const positionAccessor = this.parser.accessors[position];

    if (!positionAccessor.bufferView === undefined) {
      return;
    }

    const positionBufferView =
      this.parser.bufferViews[positionAccessor.bufferView as number];

    let tempPositionBuffer = this.getPosition(positionBufferView, positionAccessor);

    const poitions = indexBuffer.length;

    const checked = new Set();

    if (matrix) {
      for (let i = 0; i < poitions; i++) {
        const cIndex = indexBuffer[i] * 3;
        if (checked.has(cIndex)) {
          continue;
        }

        const x = tempPositionBuffer[cIndex];
        const y = tempPositionBuffer[cIndex + 1];
        const z = tempPositionBuffer[cIndex + 2];

        const m = matrix;
        const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
        const o1 = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
        const o2 = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
        const o3 = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;

        tempPositionBuffer[cIndex] = o1;
        tempPositionBuffer[cIndex + 1] = o2;
        tempPositionBuffer[cIndex + 2] = o3;

        checked.add(cIndex);
      }
    } else {
      for (let i = 0; i < poitions; i++) {
        const cIndex = indexBuffer[i] * 3;

        const x = tempPositionBuffer[cIndex];
        const y = tempPositionBuffer[cIndex + 1];
        const z = tempPositionBuffer[cIndex + 2];

        tempPositionBuffer[cIndex] = x;
        tempPositionBuffer[cIndex + 1] = y;
        tempPositionBuffer[cIndex + 2] = z;
      }
    }

    const currentI = this.positionBuffer.length / 3;

    this.idMap.set(nodeid, {start: this.indexBuffer.length, count: indexBuffer.length } )
    for (let i = 0; i < tempPositionBuffer.length; i++) {
      this.positionBuffer.push(tempPositionBuffer[i]);
    }

    for (let i = 0; i < indexBuffer.length; i++) {
      this.indexBuffer.push(indexBuffer[i] + currentI);
    }
  }

  private getIndex(bufferView: GLTF.IBufferView, accessor: GLTF.IAccessor) {
    const bufferViewOffset = bufferView.byteOffset || 0;
    const indexAccessorOffset = accessor.byteOffset || 0;
    const byteOffset = bufferViewOffset + indexAccessorOffset;
    const binBuffer = this.parser.binBuffer;

    const typeSize = accessor.componentType === 5125 ? 4 : 2;
    const length = typeSize * accessor.count;

    if (typeSize === 2) {
      const indexBuffer = new Uint16Array(
        binBuffer.slice(byteOffset, byteOffset + length).buffer
      );

      return indexBuffer;
    } else {
      const indexBuffer = new Uint32Array(
        binBuffer.slice(byteOffset, byteOffset + length).buffer
      );

      return indexBuffer;
    }
  }

  private getPosition(bufferView: GLTF.IBufferView, accessor: GLTF.IAccessor) {
    const bufferViewOffset = bufferView.byteOffset || 0;
    const indexAccessorOffset = accessor.byteOffset || 0;
    const byteOffset = bufferViewOffset + indexAccessorOffset;

    const binBuffer = this.parser.binBuffer;
    const typeSize = 4;
    const length = typeSize * (accessor.count * 3);

    const postionBuffer = new Float32Array(
      binBuffer.slice(byteOffset, byteOffset + length).buffer
    );
    return postionBuffer;
  }

  build() {
    this.index = new Uint32Array(this.indexBuffer);
    this.position = new Float32Array(this.positionBuffer);
  }


  cleanAll() {
    // this will most like kill deno if file is too big
    this.index = new Uint32Array(this.indexBuffer);
    this.indexBuffer = [];

    const positionBuffer = this.positionBuffer;

    const position: number[] = [];
    const positionMap = new Map();
    let indexCount = 0;

    for (let i = 0; i < this.index.length; i++) {
      const cIndex = this.index[i] * 3;

      const pos1 = positionBuffer[cIndex];
      const pos2 = positionBuffer[cIndex + 1];
      const pos3 = positionBuffer[cIndex + 2];

      const positionString =
        pos1.toString() + pos2.toString() + pos3.toString();

      if (positionMap.has(positionString)) {
        this.index[i] = positionMap.get(positionString);
      } else {
        this.index[i] = indexCount;
        positionMap.set(positionString, indexCount);
        indexCount++;
        position.push(positionBuffer[cIndex]);
        position.push(positionBuffer[cIndex + 1]);
        position.push(positionBuffer[cIndex + 2]);
      }
    }

    this.positionBuffer = [];
    this.position = new Float32Array(position);
  }
}
