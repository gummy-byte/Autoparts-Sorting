import { InventoryItem } from '../types';

export const generateStandardCSV = (items: InventoryItem[]) => {
    const headers = ["Quantity", "Code", "Description", "Category", "Zone 1", "Zone 2"];
    const rows = items.map(item => [item.qty, `"${item.code}"`, `"${item.description}"`, `"${item.category}"`, `"${item.zone}"`, `"${item.zone2}"`]);
    return [headers, ...rows].map(e => e.join(",")).join("\n");
};

export const generateCategorizedXLS = (items: InventoryItem[]) => {
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, InventoryItem[]>);
    const sortedCategories = Object.keys(grouped).sort();
    let globalIndex = 1;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          .header { background-color: #f1f5f9; font-weight: bold; }
          .category-header { background-color: #FFFF00; font-weight: bold; font-size: 14px; } 
          .qty-col { text-align: right; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr class="header">
              <th style="width: 50px">No</th>
              <th style="width: 150px">Code</th>
              <th style="width: 400px">Description</th>
              <th style="width: 120px">Zone 1</th>
              <th style="width: 120px">Zone 2</th>
              <th style="width: 80px">Qty</th>
            </tr>
          </thead>
          <tbody>
    `;

    sortedCategories.forEach(cat => {
      html += `<tr><td colspan="6" class="category-header">${cat.toUpperCase()}</td></tr>`;
      grouped[cat].forEach(item => {
        html += `<tr><td>${globalIndex}</td><td>${item.code}</td><td>${item.description}</td><td>${item.zone}</td><td>${item.zone2}</td><td class="qty-col">${item.qty}</td></tr>`;
        globalIndex++;
      });
    });

    html += `</tbody></table></body></html>`;
    return html;
};
