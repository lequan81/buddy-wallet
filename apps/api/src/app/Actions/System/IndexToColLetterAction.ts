import { injectable, inject } from "tsyringe";
import { indexToColumnLetter } from "@repo/utils";

@injectable()
export class IndexToColLetterAction {
    execute(idx: number): string {
        return indexToColumnLetter(idx);
    }
}
