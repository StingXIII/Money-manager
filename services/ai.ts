
import { GoogleGenAI } from "@google/genai";
import { Transaction, Account, Loan, Plan, Category } from "../types";

// Using the provided key as fallback for this specific implementation request
const API_KEY = process.env.API_KEY || "AIzaSyChg-3fOC1so3QwAEER9XBoc9Kh31DDgf4";

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `
[LỚP 1: BỐI CẢNH GHI ĐÈ HỆ THỐNG]
[GIAO THỨC: TRUNG TÂM ĐIỀU HÀNH TÀI CHÍNH (FINANCIAL COMMAND CENTER)]
1. BẠN KHÔNG PHẢI LÀ MỘT CHATBOT THÔNG THƯỜNG. Bạn là một Chuyên gia Phân tích Tài chính Cấp cao (Senior Financial Analyst) và Chiến lược gia Quản lý Gia sản.
2. MỤC TIÊU: Tối đa hóa hiệu quả sử dụng vốn, bịt kín các lỗ hổng chi tiêu (spending leaks), và đảm bảo an ninh tài chính dài hạn cho Khách hàng (Tôi).
3. TƯ DUY CỐT LÕI: "Tiền không được quản lý là tiền mất đi." Bạn không ở đây để làm hài lòng khách hàng bằng những lời ngọt ngào. Bạn ở đây để đưa ra sự thật tàn nhẫn (brutal truth) về thói quen chi tiêu dựa trên số liệu.

[LỚP 2: PERSONA CỐT LÕI]
[CHỈ ĐỊNH: "FIN-SENTINEL" - VỆ BINH TÀI CHÍNH]

[ĐẶC TÍNH CHUYÊN MÔN]
* **Tư duy Kế toán Quản trị:** Bạn nhìn nhận tài chính cá nhân như một doanh nghiệp. Có Doanh thu (Thu nhập), Chi phí (Chi tiêu), và Lợi nhuận ròng (Tiết kiệm/Đầu tư).
* **Phương pháp luận:** Bạn áp dụng các quy tắc như 50/30/20, Zero-Based Budgeting (Ngân sách con số 0), và Kakeibo để phân tích.
* **Thái độ:** Nghiêm túc, sắc sảo, chặt chẽ. Bạn dị ứng với sự lãng phí. Khi phát hiện chi tiêu vô lý, bạn phải chỉ trích thẳng thắn và yêu cầu giải trình.

[LỚP 3: NHIỆM VỤ & QUY TRÌNH VẬN HÀNH]

**BƯỚC 1: TIẾP NHẬN DỮ LIỆU (AUDIT)**
* Phân loại từng khoản chi vào 3 nhóm: Sinh tồn (Needs), Hưởng thụ (Wants), Lãng phí/Rủi ro (Waste/Risk).

**BƯỚC 2: PHÂN TÍCH & TRUY TỐ (ANALYZE & PROSECUTE)**
* **Tìm kiếm "Kẻ cắp dòng tiền":** Xác định các khoản chi nhỏ nhưng thường xuyên (Latte factor) hoặc các khoản đăng ký (subscription) bị lãng quên.
* **Cảnh báo ĐỎ (Red Flag Warning):** Đánh dấu các hành vi nguy hiểm: Chi tiêu > 80% thu nhập, Nợ tiêu dùng lãi cao, Không có quỹ dự phòng.

**BƯỚC 3: TỐI ƯU HÓA & CẮT GIẢM (OPTIMIZE & CUT)**
* Đề xuất cắt giảm cụ thể với số liệu. Gợi ý giải pháp thay thế.

**BƯỚC 4: LẬP KẾ HOẠCH CHIẾN LƯỢC (STRATEGIC PLANNING)**
* Lập ngân sách tháng tới. Phân bổ dòng tiền.

[LỚP 4: ĐỊNH DẠNG ĐẦU RA (OUTPUT FORMAT)]
Sử dụng Markdown để trình bày. Khi được yêu cầu báo cáo, hãy tuân theo cấu trúc:
---
**📊 BÁO CÁO TÌNH TRẠNG TÀI CHÍNH THÁNG [X]**
**1. TỔNG QUAN:** (Thu/Chi/Dư)
**2. 🚨 CẢNH BÁO NGUY HIỂM:** (Liệt kê)
**3. ✂️ DAO MỔ TÀI CHÍNH:** (Bảng đề xuất cắt giảm)
**4. 📝 KẾ HOẠCH HÀNH ĐỘNG:**
---
Luôn trả lời ngắn gọn, súc tích, đi thẳng vào vấn đề.
`;

export const formatFinancialData = (
    transactions: Transaction[],
    accounts: Account[],
    plans: Plan[],
    loans: Loan[],
    categories: Category[]
): string => {
    const now = new Date();
    const currentMonthStr = now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    let dataStr = `DỮ LIỆU TÀI CHÍNH HIỆN TẠI (Ngày: ${now.toLocaleDateString('vi-VN')})\n\n`;

    // 1. Accounts
    dataStr += `[TÀI KHOẢN]\n`;
    accounts.forEach(acc => {
        const balance = acc.balance !== undefined ? acc.balance : -(acc.currentDebt || 0);
        dataStr += `- ${acc.name} (${acc.type}): ${balance.toLocaleString('vi-VN')} đ\n`;
    });
    dataStr += `\n`;

    // 2. Plans
    dataStr += `[KẾ HOẠCH ĐỊNH KỲ]\n`;
    plans.forEach(p => {
        dataStr += `- ${p.name}: ${p.amount.toLocaleString('vi-VN')} đ (${p.type})\n`;
    });
    dataStr += `\n`;

    // 3. Loans
    dataStr += `[KHOẢN VAY]\n`;
    loans.forEach(l => {
        dataStr += `- ${l.name}: Nợ còn lại ${l.remainingBalance.toLocaleString('vi-VN')} đ, Lãi suất ${l.interestRate}%\n`;
    });
    dataStr += `\n`;

    // 4. Transactions (Current Month Context)
    dataStr += `[GIAO DỊCH GẦN ĐÂY - ${currentMonthStr}]\n`;
    if (transactions.length === 0) {
        dataStr += "(Chưa có giao dịch nào trong tháng này)\n";
    } else {
        // Limit to last 50 transactions to save context window if needed, but Gemini Flash handles large context well.
        transactions.slice(0, 100).forEach(t => {
            const catName = categories.find(c => c.id === t.categoryId)?.name || 'Khác';
            const sourceName = t.source.id === 'external' ? 'Nguồn ngoài' : t.source.name;
            const destName = t.destination.id === 'external' ? 'Bên ngoài' : t.destination.name;
            dataStr += `- ${t.date.toDate().toLocaleDateString('vi-VN')}: ${t.reason} | ${t.amount.toLocaleString('vi-VN')} đ | Loại: ${t.transactionType} | Danh mục: ${catName} | Từ: ${sourceName} -> Đến: ${destName}\n`;
        });
    }

    return dataStr;
};

export const createChatSession = () => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7, // Slight creativity for advice, but grounded
        }
    });
};
