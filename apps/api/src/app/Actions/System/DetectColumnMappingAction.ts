import { injectable, inject } from "tsyringe";
import type { DetectedMapping } from "@/types";

@injectable()
export class DetectColumnMappingAction {
    execute(headerRow: unknown[], columnHeaders: string[]): DetectedMapping {
        const autoMapping: DetectedMapping = {
          name: '',
          amount: '',
          phone: '',
          email: '',
          description: '',
          dueDate: ''
        };

        headerRow.forEach((header, i) => {
          const h = String(header).toLowerCase().trim();
          const col = columnHeaders[i];

          if ((h.includes('ten') || h.includes('tên') || h.includes('name')) && !autoMapping.name)
            autoMapping.name = col;
          if (
            (h.includes('so no') ||
              h.includes('số nợ') ||
              h.includes('amount') ||
              h.includes('tien') ||
              h.includes('tiền')) &&
            !autoMapping.amount
          )
            autoMapping.amount = col;
          if (
            (h.includes('phone') || h.includes('sdt') || h.includes('điện thoại')) &&
            !autoMapping.phone
          )
            autoMapping.phone = col;
          if ((h.includes('email') || h.includes('mail')) && !autoMapping.email)
            autoMapping.email = col;
          if (
            (h.includes('ghi chu') ||
              h.includes('ghi chú') ||
              h.includes('note') ||
              h.includes('desc')) &&
            !autoMapping.description
          )
            autoMapping.description = col;
          if (
            (h.includes('han') || h.includes('hạn') || h.includes('due') || h.includes('date')) &&
            !autoMapping.dueDate
          )
            autoMapping.dueDate = col;
        });

        return autoMapping;
    }
}
