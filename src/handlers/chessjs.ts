// file: chessjs.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats, { Category } from "src/CommonFormats.ts";
import { BLACK, Chess, DEFAULT_POSITION, KING, QUEEN, SQUARES, WHITE, type Color, type PieceSymbol, type Square } from 'chess.js';

// basically fen but represented as a type for json
type Game = {
  board: ({
    square: Square;
    type: PieceSymbol;
    color: Color;
  } | null)[][],
  turn: Color,
  castling: {
    [WHITE]: {
      [KING]: boolean;
      [QUEEN]: boolean;
    },
    [BLACK]: {
      [KING]: boolean;
      [QUEEN]: boolean;
    },
  },
  epSquare: Square | null,
  halfMoves: number,
  moveNumber: number,
};

function isSquare(value: string): value is Square { // ts is cool
  return (SQUARES as string[]).includes(value);
}

class chessjsHandler implements FormatHandler {

  public name: string = "chessjs";
  public supportedFormats: FileFormat[] = [
    {
      name: "Forsyth–Edwards Notation",
      format: "fen",
      extension: "fen",
      mime: "application/vnd.chess-fen",
      from: true,
      to: true,
      internal: "fen",
      category: Category.TEXT,
      lossless: false
    },
    {
      name: "Portable Game Notation",
      format: "pgn",
      extension: "pgn",
      mime: "application/vnd.chess-pgn",
      from: true,
      to: true,
      internal: "pgn",
      category: Category.TEXT,
      lossless: true
    },
    CommonFormats.TEXT.builder("txt").allowTo().markLossless(false),
    CommonFormats.JSON.builder("json").allowTo().allowFrom().markLossless(),
  ];
  public ready: boolean = false;

  async init () {
    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];
    for (const inputFile of inputFiles) {
      const chess = new Chess();

      const input = new TextDecoder().decode(inputFile.bytes).trim();
      if (inputFormat.internal === "fen") {
        chess.load(input, { skipValidation: true });
      } else if (inputFormat.internal === "pgn") {
        chess.loadPgn(input);
      } else if (inputFormat.internal === "json") {
        chess.clear();

        const game: Game = JSON.parse(input); 
        for (const row of game.board) {
          for (const square of row) {
            if (!square) continue;

            chess.put({ type: square.type, color: square.color }, square.square);
          }
        }

        chess.setTurn(game.turn);

        chess.setCastlingRights(WHITE, game.castling[WHITE]);
        chess.setCastlingRights(BLACK, game.castling[BLACK]);

        // we need fen to insert into some of the fields
        // without touching private apis. aw man!
        const fen = chess.fen().split(" ");

        fen[3] = game.epSquare ?? "-";
        fen[4] = String(game.halfMoves);
        fen[5] = String(game.moveNumber);

        chess.load(fen.join(" "), { skipValidation: true });
      } else {
        throw new Error(`chessjsHandler cannot convert from ${inputFormat.mime}`);
      }

      let output;
      if (outputFormat.internal === "fen") {
        output = chess.fen();
      } else if (outputFormat.internal === "pgn") {
        output = chess.pgn();
      } else if (outputFormat.internal === "txt") {
        output = chess.ascii();
      } else if (outputFormat.internal === "json") {
        // aargh
        const [,,,epSquare, halfMoves, moveNumber] = chess.fen().split(" ");
        const game: Game = {
          board: chess.board(),
          turn: chess.turn(),
          castling: {
            [WHITE]: chess.getCastlingRights(WHITE),
            [BLACK]: chess.getCastlingRights(BLACK),
          },
          epSquare: isSquare(epSquare) ? epSquare : null,
          halfMoves: Number(halfMoves),
          moveNumber: Number(moveNumber)
        };
        output = JSON.stringify(game);
      } else {
        throw new Error(`chessjsHandler cannot convert to ${outputFormat.mime}`);
      }

      const bytes = new TextEncoder().encode(output);
      const name = inputFile.name.replace(/\.[^.]+$/, "") + `.${outputFormat.extension}`;
      outputFiles.push({ name, bytes });
    }
    return outputFiles;
  }

}

export default chessjsHandler;