/* Tiny Tamil/English dictionary */
window.I18N = {
  en: {
    appName: "STARLYN CAPITAL FINANCE", jlgLoan: "JLG Loan", center: "Center",
    newJlg: "New JLG Loan", jlgRecords: "JLG Loan Records",
    newCenter: "New Center", centerRecords: "Center Records",
    login: "Sign in", setup: "Set up server", logout: "Log out",
    serverUrl: "Server URL", username: "Username", password: "Password", fullName: "Full name",
    customer: "Customer Name", aadhaar: "Aadhaar No", address: "Address", loanDate: "Loan Date",
    loanAmt: "Loan Amount", interest: "Interest %", tenure: "Tenure (weeks)",
    collectionDay: "Collection Day", emi: "Weekly EMI", nominee: "Nominee Name", relation: "Relation",
    save: "Save", clear: "Clear", search: "Search", status: "Status", report: "Report",
    centerName: "Center Name", centerNo: "Center No", loanNo: "Loan No",
    weekly: "Weekly Collection Report", week: "Week", due: "Due Date", collected: "Collected",
    print: "Print PDF", adminOnly: "admin only", lang: "தமிழ்",
  },
  ta: {
    appName: "ஸ்டார்லின் கேபிடல் ஃபைனான்ஸ்", jlgLoan: "JLG கடன்", center: "சென்டர்",
    newJlg: "புதிய JLG கடன்", jlgRecords: "JLG கடன் பதிவுகள்",
    newCenter: "புதிய சென்டர்", centerRecords: "சென்டர் பதிவுகள்",
    login: "உள்நுழை", setup: "சர்வர் அமை", logout: "வெளியேறு",
    serverUrl: "சர்வர் முகவரி", username: "பயனர் பெயர்", password: "கடவுச்சொல்", fullName: "முழு பெயர்",
    customer: "வாடிக்கையாளர் பெயர்", aadhaar: "ஆதார் எண்", address: "முகவரி", loanDate: "கடன் தேதி",
    loanAmt: "கடன் தொகை", interest: "வட்டி %", tenure: "காலம் (வாரங்கள்)",
    collectionDay: "வசூல் நாள்", emi: "வார தவணை", nominee: "வாரிசுதாரர்", relation: "உறவுமுறை",
    save: "சேமி", clear: "அழி", search: "தேடு", status: "நிலை", report: "அறிக்கை",
    centerName: "சென்டர் பெயர்", centerNo: "சென்டர் எண்", loanNo: "கடன் எண்",
    weekly: "வார வசூல் அறிக்கை", week: "வாரம்", due: "கடைசி தேதி", collected: "வசூல்",
    print: "PDF அச்சு", adminOnly: "நிர்வாகி மட்டும்", lang: "English",
  },
};
window.getLang = () => localStorage.getItem('jlg_lang') || 'en';
window.setLang = (l) => { localStorage.setItem('jlg_lang', l); };
window.t = (k) => (I18N[getLang()] || I18N.en)[k] || k;
