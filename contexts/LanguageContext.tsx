
import React, { createContext, useState, useContext, ReactElement, useEffect } from 'react';

type Language = 'en' | 'vi';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  en: {
    // Navbar
    nav_dashboard: "Dashboard",
    nav_transactions: "Transactions",
    nav_plans: "Plans",
    nav_loans: "Loans",
    nav_accounts: "Accounts",
    nav_categories: "Categories",
    nav_advisor: "AI Advisor",
    nav_settings: "Settings",
    nav_logout: "Logout",
    nav_toggle_theme: "Toggle Theme",

    // Dashboard
    dash_income: "Income (Month)",
    dash_expense: "Expense (Month)",
    dash_real_money: "Actual Cash",
    dash_total_debt: "Total Debt",
    dash_projected: "Projected Cash",
    dash_expense_breakdown: "Expense Breakdown",
    dash_upcoming: "Upcoming Payments",
    dash_no_data: "No expense data for this month.",
    dash_no_upcoming: "No upcoming payments.",

    // Transactions
    trans_title: "Transactions",
    trans_planned_for: "Planned for",
    trans_new: "+ New",
    trans_manage_plans: "Manage Plans",
    table_date: "Date",
    table_reason: "Reason",
    table_type: "Type",
    table_amount: "Amount",
    table_account: "Account",
    table_action: "Action",
    table_no_trans: "No transactions found for this month.",
    
    // Plans
    plans_title: "Financial Plans",
    plans_cc_repay: "Credit Card Repayments",
    plans_monthly: "Monthly Recurring Plans",
    plans_add: "+ Add Plan",
    table_card_name: "Card Name",
    table_curr_debt: "Current Debt",
    table_due_date: "Due Date",
    table_statement: "Statement",
    table_name: "Name",
    table_category: "Category",
    table_est_amount: "Est. Amount",
    btn_pay_now: "Pay Now",
    btn_pay_bill: "Pay Bill",
    btn_done: "Done",
    plans_no_cc: "No outstanding credit cards found.",
    plans_no_plans: "No monthly plans created yet.",

    // Accounts
    acc_title: "Accounts",
    acc_add_wallet: "Add a Wallet",
    acc_wallet_name: "Wallet Name",
    acc_balance: "Balance",
    acc_add_bank: "Add a Bank Account",
    acc_bank_name: "Bank Name",
    acc_limit: "Credit Limit",
    acc_your_accounts: "Your Accounts",
    acc_no_accounts: "Your added accounts will appear here.",
    acc_eom: "End of Month",
    type_bank: "Bank Acc",
    type_wallet: "Wallet",
    type_wallet_group: "Physical Money",
    type_credit: "Credit Card",
    btn_add_wallet: "+ Add Wallet",
    btn_add_bank: "+ Add Bank",
    btn_add_card: "ADD CARD",
    btn_update_card: "Update Card",
    btn_save_card: "Save Card",
    
    // Account Headers
    th_name: "Name",
    th_type: "Type",
    th_balance: "Balance",
    th_limit: "Credit Limit",
    th_debt: "Current Debt",
    th_statement: "Statement Date",
    th_payment: "Payment Date",
    th_fee: "Fee (%)",
    th_cashback: "Cashback (%)",
    th_max_cashback: "Max Cashback",
    th_points: "Points",
    th_actions: "Actions",

    // Categories
    cat_title: "Manage Categories",
    cat_expense: "Expense Categories",
    cat_add_expense: "+ Add Expense",
    cat_no_expense: "No expense categories found.",
    cat_income: "Income Categories",
    cat_add_income: "+ Add Income",
    cat_no_income: "No income categories found.",
    cat_name: "Category Name",
    cat_save: "Save Category",
    cat_edit: "Edit Category",
    cat_add: "Add Category",
    cat_btn_save: "Save Category",

    // Loans
    loan_title: "Loans",
    loan_add: "+ Add Loan",
    loan_edit: "Edit Loan",
    loan_no_loans: "No loans found.",
    loan_from: "From",
    loan_remaining: "Remaining",
    loan_interest: "Interest",
    loan_term: "Term",
    loan_period: "Period",
    loan_view_schedule: "View Schedule",
    loan_delete: "Delete Loan",
    loan_delete_confirm_title: "Delete Loan",
    loan_delete_confirm_msg: "Are you sure you want to delete",
    loan_delete_confirm_msg_2: "This will also delete its payment schedule history.",

    // Loan Schedule
    sched_title: "Payment Schedule",
    sched_date: "Date",
    sched_principal: "Principal",
    sched_interest: "Interest",
    sched_total: "Total",
    sched_rate: "Rate (%)",
    sched_remaining: "Remaining",
    sched_action: "Actions",
    sched_paid: "Paid",
    sched_pay: "Pay",

    // Forms (Common)
    form_reason: "Reason",
    form_total_amount: "Total Amount",
    form_monthly_principal: "Monthly Principal",
    form_start_date: "Start Date",
    form_first_payment: "First Payment Date",
    form_maturity_date: "Maturity Date",
    form_interest_rate: "Interest Rate (%/year)",
    form_term_months: "Term (months)",
    form_source_acc: "From Account",
    form_remaining: "Remaining Balance",
    form_save: "Save",
    form_update: "Update",
    form_cancel: "Cancel",
    form_auto_calc: "Auto-calculated, edit to fix exact amount",
    form_bank_date: "Exact date bank collects payment",
    
    // Common Actions
    btn_edit: "Edit",
    btn_delete: "Delete",

    // Auth
    auth_login_title: "Login",
    auth_signup_title: "Sign Up",
    auth_email: "Email",
    auth_password: "Password",
    auth_login_btn: "Sign In",
    auth_signup_btn: "Sign Up",
    auth_processing: "Processing...",
    auth_no_account: "Don't have an account?",
    auth_has_account: "Already have an account?",
    auth_toggle_signup: "Sign up",
    auth_toggle_signin: "Sign in",

    // Settings
    set_title: "Settings",
    set_general: "General Settings",
    set_language: "Language",
    set_danger: "Danger Zone",
    set_delete_desc: "Deleting all data will permanently remove your account information, transactions, and settings.",
    set_reset_btn: "Reset All Data",
    set_confirm_title: "Warning: Irreversible Action",
    set_confirm_msg: "This will permanently delete all your transactions, accounts, categories, loans, and plans. You will be logged out immediately.",
    set_type_delete: "Type DELETE to confirm",
    set_confirm_reset: "Yes, Delete Everything",
    set_cancel: "Cancel",
  },
  vi: {
    // Navbar
    nav_dashboard: "Tổng quan",
    nav_transactions: "Giao dịch",
    nav_plans: "Kế hoạch",
    nav_loans: "Khoản vay",
    nav_accounts: "Tài khoản",
    nav_categories: "Danh mục",
    nav_advisor: "Trợ lý AI",
    nav_settings: "Cài đặt",
    nav_logout: "Đăng xuất",
    nav_toggle_theme: "Đổi giao diện",

    // Dashboard
    dash_income: "Thu nhập (Tháng)",
    dash_expense: "Chi tiêu (Tháng)",
    dash_real_money: "Tiền thực tế",
    dash_total_debt: "Tổng nợ",
    dash_projected: "Tiền dự kiến",
    dash_expense_breakdown: "Cơ cấu chi tiêu",
    dash_upcoming: "Sắp đến hạn",
    dash_no_data: "Không có dữ liệu chi tiêu tháng này.",
    dash_no_upcoming: "Không có khoản nào sắp đến hạn.",

    // Transactions
    trans_title: "Giao dịch",
    trans_planned_for: "Dự kiến cho",
    trans_new: "+ Mới",
    trans_manage_plans: "Quản lý kế hoạch",
    table_date: "Ngày",
    table_reason: "Nội dung",
    table_type: "Loại",
    table_amount: "Số tiền",
    table_account: "Tài khoản",
    table_action: "Hành động",
    table_no_trans: "Không có giao dịch nào trong tháng này.",
    
    // Plans
    plans_title: "Kế hoạch tài chính",
    plans_cc_repay: "Thanh toán thẻ tín dụng",
    plans_monthly: "Kế hoạch định kỳ hàng tháng",
    plans_add: "+ Thêm kế hoạch",
    table_card_name: "Tên thẻ",
    table_curr_debt: "Dư nợ hiện tại",
    table_due_date: "Hạn thanh toán",
    table_statement: "Sao kê",
    table_name: "Tên",
    table_category: "Danh mục",
    table_est_amount: "Dự kiến",
    btn_pay_now: "Trả ngay",
    btn_pay_bill: "Thanh toán",
    btn_done: "Xong",
    plans_no_cc: "Không tìm thấy dư nợ thẻ tín dụng.",
    plans_no_plans: "Chưa có kế hoạch hàng tháng nào.",

    // Accounts
    acc_title: "Tài khoản",
    acc_add_wallet: "Thêm Ví",
    acc_wallet_name: "Tên Ví",
    acc_balance: "Số dư",
    acc_add_bank: "Thêm Ngân hàng",
    acc_bank_name: "Tên Ngân hàng",
    acc_limit: "Hạn mức",
    acc_your_accounts: "Tài khoản của bạn",
    acc_no_accounts: "Các tài khoản đã thêm sẽ hiện ở đây.",
    acc_eom: "Cuối tháng",
    type_bank: "Ngân hàng",
    type_wallet: "Ví tiền",
    type_wallet_group: "Tiền mặt",
    type_credit: "Thẻ tín dụng",
    btn_add_wallet: "+ Thêm Ví",
    btn_add_bank: "+ Thêm Ngân hàng",
    btn_add_card: "THÊM THẺ",
    btn_update_card: "Cập nhật thẻ",
    btn_save_card: "Lưu thẻ",

    // Account Headers
    th_name: "Tên",
    th_type: "Loại",
    th_balance: "Số dư",
    th_limit: "Hạn mức",
    th_debt: "Dư nợ",
    th_statement: "Ngày sao kê",
    th_payment: "Ngày thanh toán",
    th_fee: "Phí (%)",
    th_cashback: "Hoàn tiền (%)",
    th_max_cashback: "Max Hoàn tiền",
    th_points: "Điểm",
    th_actions: "Hành động",

    // Categories
    cat_title: "Quản lý danh mục",
    cat_expense: "Danh mục Chi tiêu",
    cat_add_expense: "+ Thêm Chi tiêu",
    cat_no_expense: "Chưa có danh mục chi tiêu.",
    cat_income: "Danh mục Thu nhập",
    cat_add_income: "+ Thêm Thu nhập",
    cat_no_income: "Chưa có danh mục thu nhập.",
    cat_name: "Tên danh mục",
    cat_save: "Lưu danh mục",
    cat_edit: "Sửa danh mục",
    cat_add: "Thêm danh mục",
    cat_btn_save: "Lưu danh mục",

    // Loans
    loan_title: "Khoản vay",
    loan_add: "+ Thêm khoản vay",
    loan_edit: "Sửa khoản vay",
    loan_no_loans: "Chưa có khoản vay nào.",
    loan_from: "Từ",
    loan_remaining: "Còn lại",
    loan_interest: "Lãi suất",
    loan_term: "Kỳ hạn",
    loan_period: "Thời gian",
    loan_view_schedule: "Xem lịch trả",
    loan_delete: "Xóa khoản vay",
    loan_delete_confirm_title: "Xóa khoản vay",
    loan_delete_confirm_msg: "Bạn có chắc chắn muốn xóa khoản vay",
    loan_delete_confirm_msg_2: "Hành động này sẽ xóa toàn bộ lịch sử trả nợ của khoản vay này.",

    // Loan Schedule
    sched_title: "Lịch trả nợ",
    sched_date: "Ngày",
    sched_principal: "Gốc",
    sched_interest: "Lãi",
    sched_total: "Tổng",
    sched_rate: "Lãi suất (%)",
    sched_remaining: "Còn lại",
    sched_action: "Hành động",
    sched_paid: "Đã trả",
    sched_pay: "Trả",

    // Forms (Common)
    form_reason: "Lý do / Tên",
    form_total_amount: "Tổng số tiền",
    form_monthly_principal: "Tiền gốc hàng tháng",
    form_start_date: "Ngày bắt đầu",
    form_first_payment: "Ngày trả lần đầu",
    form_maturity_date: "Ngày kết thúc dự kiến",
    form_interest_rate: "Lãi suất (%/năm)",
    form_term_months: "Kỳ hạn (tháng)",
    form_source_acc: "Tài khoản nguồn",
    form_remaining: "Số tiền còn lại",
    form_save: "Lưu",
    form_update: "Cập nhật",
    form_cancel: "Hủy",
    form_auto_calc: "Tự động tính, sửa nếu muốn nhập số cố định",
    form_bank_date: "Chính xác ngày ngân hàng thu nợ",

    // Common Actions
    btn_edit: "Sửa",
    btn_delete: "Xóa",

    // Auth
    auth_login_title: "Đăng nhập",
    auth_signup_title: "Đăng ký",
    auth_email: "Email",
    auth_password: "Mật khẩu",
    auth_login_btn: "Đăng nhập",
    auth_signup_btn: "Đăng ký",
    auth_processing: "Đang xử lý...",
    auth_no_account: "Chưa có tài khoản?",
    auth_has_account: "Đã có tài khoản?",
    auth_toggle_signup: "Đăng ký ngay",
    auth_toggle_signin: "Đăng nhập ngay",

    // Settings
    set_title: "Cài đặt",
    set_general: "Cài đặt chung",
    set_language: "Ngôn ngữ",
    set_danger: "Vùng nguy hiểm",
    set_delete_desc: "Xóa toàn bộ dữ liệu sẽ xóa vĩnh viễn thông tin tài khoản, giao dịch và cài đặt của bạn.",
    set_reset_btn: "Xóa toàn bộ dữ liệu",
    set_confirm_title: "Cảnh báo: Hành động không thể hoàn tác",
    set_confirm_msg: "Hành động này sẽ xóa vĩnh viễn tất cả giao dịch, tài khoản, danh mục, khoản vay và kế hoạch của bạn. Bạn sẽ bị đăng xuất ngay lập tức.",
    set_type_delete: "Gõ DELETE để xác nhận",
    set_confirm_reset: "Có, Xóa tất cả",
    set_cancel: "Hủy",
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: React.PropsWithChildren<{}>): ReactElement => {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('language') as Language;
      return savedLang === 'en' || savedLang === 'vi' ? savedLang : 'en';
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
