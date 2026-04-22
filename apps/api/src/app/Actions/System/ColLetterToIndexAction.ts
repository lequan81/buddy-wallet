import { injectable, inject } from "tsyringe";
import { colToZeroBasedIndex } from "@repo/utils";

@injectable()
export class ColLetterToIndexAction {
    execute(col: string): number {
        return colToZeroBasedIndex(col);
    }
}
