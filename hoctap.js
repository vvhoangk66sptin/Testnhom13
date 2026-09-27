/*
  File: hoctap.js   |  NGƯỜI PHỤ TRÁCH: C (thành viên 3) — BẢN HOÀN CHỈNH
  Mục đích: Ba việc trong một file:
            (1) Chuyển TAB        — phần chung
            (2) Logic khu vực HỌC TẬP (môn học + deadline)
            (3) Khu vực TỔNG QUAN (Dashboard) — số dư, deadline gần nhất,
                số môn đang học, 2 biểu đồ, diễn biến gần đây

  HỢP ĐỒNG (mục 1.3, 1.4):
  - C sở hữu: formatTienIch(), escapeHtml(), chuyenTab(), capNhatDashboard(),
    initDashboard(), initHocTap(), ganSuKienTab(), khoiDongUngDung().
  - C KHÔNG định nghĩa lại hàm của B (dinhDangNgay, hienLoi, ngayHomNay,
    getTenDanhMuc, getSoDuHienTai...). Khi cần dùng hàm của B, C bọc bằng
    guard `typeof ... === 'function'` để chạy được cả khi B chưa xong.
  - localStorage của C: 'sv.deadline.v1' và 'sv.tabHienTai.v1'.
*/

/* ================================================================
   PHẦN 0 — TIỆN ÍCH CHUNG (B cũng dùng 2 hàm này)
   ================================================================ */

/**
 * formatTienIch: đổi số thành chuỗi tiền Việt Nam.
 * - Nhận vào: viTri (number|string, đơn vị đồng; chấp nhận âm).
 * - Trả về: string, ví dụ 1500000 -> '1.500.000 đ', rỗng/NaN -> '0 đ'.
 */
function formatTienIch(viTri) {
  var so = Number(viTri);
  if (!isFinite(so)) so = 0;
  return so.toLocaleString("vi-VN") + " đ";
}

/**
 * escapeHtml: làm sạch chuỗi trước khi nhét vào innerHTML.
 * - Nhận vào: chuoi (bất kỳ).  - Trả về: string an toàn.
 * - SỞ HỮU: file C. B gọi bên trong function body, cấm định nghĩa lại.
 */
function escapeHtml(chuoi) {
  return String(chuoi == null ? "" : chuoi).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

/* ================================================================
   PHẦN 0b — HÀM BỌC AN TOÀN CÁC TIỆN ÍCH CỦA B
   (C dùng được ngay cả khi chitieu.js chưa load xong)
   ================================================================ */

/**
 * hienThiNgay: 'YYYY-MM-DD' -> 'dd/MM/yyyy' (bọc dinhDangNgay của B).
 */
function hienThiNgay(chuoiNgay) {
  if (typeof dinhDangNgay === "function") return dinhDangNgay(chuoiNgay);
  if (!chuoiNgay || typeof chuoiNgay !== "string") return "";
  var p = chuoiNgay.split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : chuoiNgay;
}

/**
 * tenDanhMucAnToan: nhãn danh mục (bọc getTenDanhMuc của B).
 */
function tenDanhMucAnToan(giaTri) {
  if (typeof getTenDanhMuc === "function") return getTenDanhMuc(giaTri);
  return giaTri || "Khác";
}

/**
 * ngayCuaHomNay: 'YYYY-MM-DD' hôm nay (bọc ngayHomNay của B, có fallback).
 */
function ngayCuaHomNay() {
  if (typeof ngayHomNay === "function") return ngayHomNay();
  var d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/* ================================================================
   PHẦN 1 — CHUYỂN TAB
   ================================================================ */

var KEY_TAB = "sv.tabHienTai.v1";
var DANH_SACH_TAB = ["tong-quan", "chi-tieu", "hoc-tap"];

/**
 * chuyenTab: ẩn 2 panel, hiện panel ứng với tenTab, đổi nút active.
 * - Nhận vào: tenTab ('tong-quan' | 'chi-tieu' | 'hoc-tap').
 */
function chuyenTab(tenTab) {
  if (DANH_SACH_TAB.indexOf(tenTab) === -1) tenTab = "tong-quan";

  var cacNut = document.querySelectorAll("#tabNav .tab-btn");
  for (var i = 0; i < cacNut.length; i++) {
    var laTabNay = cacNut[i].getAttribute("data-tab") === tenTab;
    cacNut[i].classList.toggle("tab-btn--active", laTabNay);
  }

  var cacPanel = document.querySelectorAll(".tab-panel");
  for (var j = 0; j < cacPanel.length; j++) {
    var hienRa = cacPanel[j].id === "section-" + tenTab;
    cacPanel[j].classList.toggle("tab-panel--hidden", !hienRa);
    cacPanel[j].hidden = !hienRa;
  }

  try {
    localStorage.setItem(KEY_TAB, tenTab);
  } catch (loi) {
    /* localStorage bị chặn — bỏ qua, tab vẫn chuyển được */
  }

  if (tenTab === "tong-quan") capNhatDashboard();
}

/**
 * ganSuKienTab: gắn click cho 3 nút tab + khôi phục tab mở lần trước.
 */
function ganSuKienTab() {
  var cacNut = document.querySelectorAll("#tabNav .tab-btn");
  for (var i = 0; i < cacNut.length; i++) {
    cacNut[i].addEventListener("click", function () {
      chuyenTab(this.getAttribute("data-tab"));
    });
  }

  var tabLanTruoc = null;
  try {
    tabLanTruoc = localStorage.getItem(KEY_TAB);
  } catch (loi) {
    tabLanTruoc = null;
  }
  if (tabLanTruoc && DANH_SACH_TAB.indexOf(tabLanTruoc) !== -1) {
    chuyenTab(tabLanTruoc);
  }
}

/* ================================================================
   PHẦN 2 — HỌC TẬP: ĐỌC / GHI DỮ LIỆU
   ================================================================ */

var KEY_DEADLINE = "sv.deadline.v1";

// Mảng deadline — nguồn dữ liệu duy nhất của khu vực Học tập
var dsDeadline = [];

/**
 * docDeadline: nạp dsDeadline từ 'sv.deadline.v1' (chống dữ liệu hỏng).
 */
function docDeadline() {
  var duLieu = [];
  try {
    duLieu = JSON.parse(localStorage.getItem(KEY_DEADLINE)) || [];
  } catch (loi) {
    console.warn("[hoctap] Dữ liệu deadline hỏng, khởi tạo lại.", loi);
    duLieu = [];
  }

  if (!Array.isArray(duLieu)) duLieu = [];

  dsDeadline = duLieu
    .filter(function (dl) {
      return dl && typeof dl === "object" && dl.id && dl.tenMon;
    })
    .map(function (dl) {
      return {
        id: String(dl.id),
        tenMon: String(dl.tenMon),
        viecCanLam: String(dl.viecCanLam || ""),
        hanChot: dl.hanChot || "",
        hoanThanh: dl.hoanThanh === true,
      };
    });
}

/**
 * ghiDeadline: ghi dsDeadline xuống 'sv.deadline.v1'.
 */
function ghiDeadline() {
  try {
    localStorage.setItem(KEY_DEADLINE, JSON.stringify(dsDeadline));
  } catch (loi) {
    alert("Không lưu được dữ liệu học tập (localStorage đầy hoặc bị chặn).");
  }
}

/**
 * taoIdDeadline: sinh id duy nhất cho deadline.
 */
function taoIdDeadline() {
  return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ================================================================
   PHẦN 3 — HỌC TẬP: THÊM / SỬA / XÓA
   ================================================================ */

/**
 * xoaLoiFormHocTap: xóa nhãn lỗi trong form Học tập (C tự có, không đụng B).
 */
function xoaLoiFormHocTap() {
  var cacLoi = document.querySelectorAll("#formHocTap .form-error");
  for (var i = 0; i < cacLoi.length; i++) cacLoi[i].remove();
}

/**
 * hienLoiHocTap: in nhãn lỗi dưới input của form Học tập.
 */
function hienLoiHocTap(maSoInput, thongBao) {
  var input = document.getElementById(maSoInput);
  if (!input) return;
  var dong = input.closest(".form-row");
  if (!dong) return;

  var noi = dong.querySelector(".form-error");
  if (!noi) {
    noi = document.createElement("p");
    noi.className = "form-error";
    dong.appendChild(noi);
  }
  noi.textContent = thongBao;
}

/**
 * themDeadline: validate form #formHocTap rồi thêm 1 deadline.
 * - Nhận vào: e (event submit).  - Trả về: true nếu thêm thành công.
 */
function themDeadline(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();

  xoaLoiFormHocTap();

  var tenMon = document.getElementById("tenMon").value.trim();
  var viecCanLam = document.getElementById("viecCanLam").value.trim();
  var hanChot = document.getElementById("hanChot").value;

  var hopLe = true;

  if (!tenMon) {
    hienLoiHocTap("tenMon", "Nhập tên môn học.");
    hopLe = false;
  }
  if (!viecCanLam) {
    hienLoiHocTap("viecCanLam", "Nhập việc cần làm.");
    hopLe = false;
  }
  if (!hanChot) {
    hienLoiHocTap("hanChot", "Chọn hạn chót.");
    hopLe = false;
  } else if (soNgayConLai(hanChot) < 0) {
    // vẫn cho lưu, nhưng cảnh báo
    hienLoiHocTap(
      "hanChot",
      "Lưu ý: hạn chót này đã qua " +
        Math.abs(soNgayConLai(hanChot)) +
        ' ngày — mục sẽ bị đánh dấu "Quá hạn".',
    );
  }

  if (!hopLe) return false;

  dsDeadline.push({
    id: taoIdDeadline(),
    tenMon: tenMon,
    viecCanLam: viecCanLam,
    hanChot: hanChot,
    hoanThanh: false,
  });

  ghiDeadline();
  renderBangHocTap();
  capNhatDashboard();

  document.getElementById("formHocTap").reset();
  document.getElementById("hanChot").min = ngayCuaHomNay();
  document.getElementById("tenMon").focus();

  return true;
}

/**
 * chuyenTrangThaiDeadline: đảo cờ hoanThanh (chưa xong <-> đã xong).
 */
function chuyenTrangThaiDeadline(idDeadline) {
  for (var i = 0; i < dsDeadline.length; i++) {
    if (dsDeadline[i].id === String(idDeadline)) {
      dsDeadline[i].hoanThanh = !dsDeadline[i].hoanThanh;
      break;
    }
  }
  ghiDeadline();
  renderBangHocTap();
  capNhatDashboard();
}

/**
 * xoaDeadline: xóa 1 deadline (có xác nhận).
 */
function xoaDeadline(idDeadline) {
  var index = -1;
  for (var i = 0; i < dsDeadline.length; i++) {
    if (dsDeadline[i].id === String(idDeadline)) {
      index = i;
      break;
    }
  }
  if (index === -1) return;

  if (!confirm('Xóa deadline "' + dsDeadline[index].tenMon + '"?')) return;

  dsDeadline.splice(index, 1);
  ghiDeadline();
  renderBangHocTap();
  capNhatDashboard();
}

/* ================================================================
   PHẦN 4 — HỌC TẬP: TÍNH TOÁN NGÀY & TRẠNG THÁI
   ================================================================ */

/**
 * soNgayConLai: số ngày từ hôm nay tới hạn chót.
 * - Nhận vào: chuoiHanChot ('YYYY-MM-DD').
 * - CHÚ Ý: new Date('2026-10-05') là UTC -> tách tay số rồi dùng
 *   new Date(y, m-1, d) để tính theo giờ địa phương, không lệch ngày.
 * - Trả về: number. >0 còn lại, 0 hôm nay, <0 quá hạn.
 */
function soNgayConLai(chuoiHanChot) {
  if (!chuoiHanChot || typeof chuoiHanChot !== "string") return 0;

  var p = chuoiHanChot.split("-");
  if (p.length !== 3) return 0;

  var nam = Number(p[0]);
  var thang = Number(p[1]);
  var ngay = Number(p[2]);
  if (!nam || !thang || !ngay) return 0;

  var han = new Date(nam, thang - 1, ngay);
  var homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  han.setHours(0, 0, 0, 0);

  return Math.round((han.getTime() - homNay.getTime()) / 86400000);
}

/**
 * classTrangThai: class badge cho cột Trạng thái.
 * - Nhận vào: object deadline.  - Trả về: string class.
 */
function classTrangThai(deadline) {
  if (deadline.hoanThanh) return "badge--hoan-thanh";
  var con = soNgayConLai(deadline.hanChot);
  if (con < 0) return "badge--qua-han";
  if (con === 0) return "badge--hom-nay";
  if (con <= 3) return "badge--sop";
  return "badge--suan";
}

/**
 * nhanTrangThai: nhãn tiếng Việt cho cột "Trạng thái".
 * - Nhận vào: object deadline.  - Trả về: string.
 */
function nhanTrangThai(deadline) {
  if (deadline.hoanThanh) return "Hoàn thành";
  var con = soNgayConLai(deadline.hanChot);
  if (con < 0) return "Quá hạn " + Math.abs(con) + " ngày";
  if (con === 0) return "Hạn hôm nay!";
  return "Còn " + con + " ngày";
}

/**
 * layDeadlineGanNhat: deadline gần nhất CHƯA hoàn thành.
 * - Ưu tiên deadline chưa tới hạn; nếu chỉ còn toàn cái quá hạn thì lấy
 *   cái quá hạn gần nhất.  - Trả về: object hoặc null.
 */
function layDeadlineGanNhat() {
  var chuaXong = dsDeadline.filter(function (dl) {
    return !dl.hoanThanh;
  });
  if (chuaXong.length === 0) return null;

  var sapToiHan = chuaXong.filter(function (dl) {
    return soNgayConLai(dl.hanChot) >= 0;
  });
  var danhSach = sapToiHan.length > 0 ? sapToiHan : chuaXong;

  var banSao = danhSach.slice();
  banSao.sort(function (a, b) {
    return String(a.hanChot).localeCompare(String(b.hanChot));
  });
  return banSao[0];
}

/**
 * demSoMonDangHoc: số MÔN KHÁC NHAU (không phải số deadline).
 * - Soa thường + trim khi so sánh.  - Trả về: number.
 */
function demSoMonDangHoc() {
  var cacMon = {};
  for (var i = 0; i < dsDeadline.length; i++) {
    var key = dsDeadline[i].tenMon.trim().toLowerCase();
    if (key) cacMon[key] = true;
  }
  var dem = 0;
  for (var key in cacMon) {
    if (Object.prototype.hasOwnProperty.call(cacMon, key)) dem++;
  }
  return dem;
}

/* ================================================================
   PHẦN 5 — HỌC TẬP: RENDER BẢNG
   ================================================================ */

/**
 * renderBangHocTap: vẽ lại #tbodyHocTap (sắp theo hạn chót tăng dần).
 */
function renderBangHocTap() {
  var tbody = document.getElementById("tbodyHocTap");
  if (!tbody) return;

  if (dsDeadline.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-row">' +
      "Chưa có deadline nào. Thêm việc cần làm ở form trên.</td></tr>";
    return;
  }

  var banSao = dsDeadline.slice();
  banSao.sort(function (a, b) {
    var soSanh = String(a.hanChot).localeCompare(String(b.hanChot));
    if (soSanh !== 0) return soSanh;
    return String(a.id).localeCompare(String(b.id));
  });

  var html = "";
  for (var i = 0; i < banSao.length; i++) {
    var dl = banSao[i];
    var labelNut = dl.hoanThanh ? "Bỏ hoàn thành" : "Hoàn thành";

    html +=
      "<tr" +
      (dl.hoanThanh ? ' class="row-hoan-thanh"' : "") +
      ">" +
      "<td>" +
      escapeHtml(dl.tenMon) +
      "</td>" +
      "<td>" +
      escapeHtml(dl.viecCanLam) +
      "</td>" +
      "<td>" +
      escapeHtml(hienThiNgay(dl.hanChot)) +
      "</td>" +
      '<td><span class="badge ' +
      classTrangThai(dl) +
      '">' +
      escapeHtml(nhanTrangThai(dl)) +
      "</span></td>" +
      "<td>" +
      '<button type="button" class="btn btn-hoanthanh" ' +
      'data-hoanthanh="' +
      escapeHtml(dl.id) +
      '">' +
      labelNut +
      "</button> " +
      '<button type="button" class="btn btn--danger btn-xoa" ' +
      'data-xoa="' +
      escapeHtml(dl.id) +
      '">Xóa</button>' +
      "</td>" +
      "</tr>";
  }
  tbody.innerHTML = html;
}

/* ================================================================
   PHẦN 6 — DASHBOARD
   ================================================================ */

/**
 * capNhatDashboard: điền lại toàn bộ khu vực Tổng quan.
 * - Dùng guard typeof với các hàm của B để C test được trước khi B xong.
 */
function capNhatDashboard() {
  // 1) Số dư hiện tại — số liệu của B
  var oSoDu = document.getElementById("statSoDuValue");
  if (oSoDu) {
    if (typeof getSoDuHienTai === "function") {
      var soDu = getSoDuHienTai();
      oSoDu.textContent = formatTienIch(soDu);
      oSoDu.classList.remove("text-thu", "text-chi");
      oSoDu.classList.add(soDu < 0 ? "text-chi" : "text-thu");
    } else {
      oSoDu.textContent = "— đ (chưa nạp module Chi tiêu)";
    }
  }

  // 2) Deadline gần nhất — số liệu của C
  var oDeadline = document.getElementById("statDeadlineValue");
  if (oDeadline) {
    var ganNhat = layDeadlineGanNhat();
    if (!ganNhat) {
      oDeadline.textContent = "Không có deadline";
    } else {
      var con = soNgayConLai(ganNhat.hanChot);
      var moTa;
      if (con < 0) moTa = " — quá hạn " + Math.abs(con) + " ngày";
      else if (con === 0) moTa = " — hạn HÔM NAY";
      else moTa = " — còn " + con + " ngày";
      oDeadline.textContent = hienThiNgay(ganNhat.hanChot) + moTa;
    }
    oDeadline.classList.remove("text-thu", "text-chi");
    if (ganNhat && soNgayConLai(ganNhat.hanChot) <= 0) {
      oDeadline.classList.add("text-chi");
    }
  }

  // 3) Số môn đang học — số liệu của C
  var oSoMon = document.getElementById("statSoMonValue");
  if (oSoMon) oSoMon.textContent = String(demSoMonDangHoc());

  // 4) Số giao dịch đã ghi — số liệu của B
  var oSoGd = document.getElementById("statGiaoDichValue");
  if (oSoGd) {
    oSoGd.textContent =
      typeof soGiaoDichHienCo === "function" ? String(soGiaoDichHienCo()) : "—";
  }

  // 5) Biểu đồ + danh sách gần đây
  veBieuDoDanhMuc();
  veBieuDoTheoNgay();
  renderDanhSachGanDay();
}

/**
 * veBieuDoDanhMuc: vẽ cột ngang chi tiêu theo danh mục vào #chartDanhMuc.
 * - Số liệu: getTongTheoDanhMuc() + getTenDanhMuc() của B.
 */
function veBieuDoDanhMuc() {
  var khung = document.getElementById("chartDanhMuc");
  if (!khung) return;

  if (typeof getTongTheoDanhMuc !== "function") {
    khung.innerHTML =
      '<p class="chart__empty">Chưa nạp được module Chi tiêu.</p>';
    return;
  }

  var duLieu = getTongTheoDanhMuc();
  if (duLieu.length === 0) {
    khung.innerHTML =
      '<p class="chart__empty">Chưa có khoản chi nào để vẽ biểu đồ.</p>';
    return;
  }

  var max = 0;
  for (var i = 0; i < duLieu.length; i++) {
    if (duLieu[i].tongTien > max) max = duLieu[i].tongTien;
  }
  if (max <= 0) max = 1;

  var html = "";
  for (var j = 0; j < duLieu.length; j++) {
    var item = duLieu[j];
    var phanTram = Math.max(2, Math.round((item.tongTien / max) * 100));
    html +=
      '<div class="chart-bar">' +
      '<span class="chart__label">' +
      escapeHtml(tenDanhMucAnToan(item.danhMuc)) +
      "</span>" +
      '<div class="chart__track">' +
      '<div class="chart-fill" style="width:' +
      phanTram +
      '%"></div>' +
      "</div>" +
      '<span class="chart__value">' +
      escapeHtml(formatTienIch(item.tongTien)) +
      "</span>" +
      "</div>";
  }
  khung.innerHTML = html;
}

/**
 * veBieuDoTheoNgay: vẽ cột dọc tổng chi 7 ngày gần nhất vào #chartTheoNgay.
 * - Số liệu: getThongKeTheoNgay() của B.
 */
function veBieuDoTheoNgay() {
  var khung = document.getElementById("chartTheoNgay");
  if (!khung) return;

  if (typeof getThongKeTheoNgay !== "function") {
    khung.innerHTML =
      '<p class="chart__empty">Chưa nạp được module Chi tiêu.</p>';
    return;
  }

  var duLieu = getThongKeTheoNgay();
  if (duLieu.length === 0) {
    khung.innerHTML =
      '<p class="chart__empty">Chưa có ngày nào có khoản chi.</p>';
    return;
  }

  var max = 0;
  for (var i = 0; i < duLieu.length; i++) {
    if (duLieu[i].tongTien > max) max = duLieu[i].tongTien;
  }
  if (max <= 0) max = 1;

  var html = "";
  for (var j = 0; j < duLieu.length; j++) {
    var item = duLieu[j];
    var chieuCao = Math.max(3, Math.round((item.tongTien / max) * 100));
    html +=
      '<div class="chart-col">' +
      '<span class="chart-col__value">' +
      escapeHtml(formatTienIch(item.tongTien)) +
      "</span>" +
      '<div class="chart-col__fill" style="height:' +
      chieuCao +
      '%"></div>' +
      '<span class="chart-col__label">' +
      escapeHtml(hienThiNgay(item.ngay).slice(0, 5)) +
      "</span>" +
      "</div>";
  }
  khung.innerHTML = html;
}

/**
 * renderDanhSachGanDay: #danhSachGanDay = 3 deadline sắp tới +
 * 3 giao dịch gần đây (lấy từ B).
 */
function renderDanhSachGanDay() {
  var danhSach = document.getElementById("danhSachGanDay");
  if (!danhSach) return;

  var html = "";

  // --- Phần HỌC TẬP: 3 deadline chưa xong gần nhất ---
  var chuaXong = dsDeadline
    .filter(function (dl) {
      return !dl.hoanThanh;
    })
    .slice()
    .sort(function (a, b) {
      return String(a.hanChot).localeCompare(String(b.hanChot));
    })
    .slice(0, 3);

  for (var i = 0; i < chuaXong.length; i++) {
    var dl = chuaXong[i];
    html +=
      "<li>" +
      '<span class="badge badge--suan">HỌC</span> ' +
      escapeHtml(dl.tenMon) +
      " — " +
      escapeHtml(dl.viecCanLam) +
      " <em>(" +
      escapeHtml(nhanTrangThai(dl)) +
      ", hạn " +
      escapeHtml(hienThiNgay(dl.hanChot)) +
      ")</em>" +
      "</li>";
  }

  // --- Phần CHI TIÊU: 3 giao dịch gần nhất (guard typeof) ---
  if (typeof getGiaoDichGanDay === "function") {
    var cacGd = getGiaoDichGanDay(3);
    for (var j = 0; j < cacGd.length; j++) {
      var gd = cacGd[j];
      var tenLoai = gd.loai === "thu" ? "Thu" : "Chi";
      html +=
        "<li>" +
        '<span class="badge badge--' +
        gd.loai +
        '">' +
        tenLoai +
        "</span> " +
        escapeHtml(gd.noiDung) +
        " — " +
        escapeHtml(formatTienIch(gd.soTien)) +
        " <em>(" +
        escapeHtml(hienThiNgay(gd.ngay)) +
        ")</em>" +
        "</li>";
    }
  }

  if (html === "") {
    html =
      '<li class="empty-row">Chưa có dữ liệu — hãy thêm deadline hoặc giao dịch.</li>';
  }

  danhSach.innerHTML = html;
}

/* ================================================================
  
   ================================================================ */

/**
 * initHocTap: nạp dữ liệu, vẽ bảng, nối sự kiện khu vực Học tập.
 */
function initHocTap() {
  docDeadline();
  renderBangHocTap();

  var form = document.getElementById("formHocTap");
  if (form) form.addEventListener("submit", themDeadline);

  // Event delegation: 1 listener duy nhất cho toàn bảng (nút Hoàn thành + Xóa)
  var bang = document.getElementById("bangHocTap");
  if (bang) {
    bang.addEventListener("click", function (e) {
      var nutHC = e.target.closest("[data-hoanthanh]");
      if (nutHC) {
        chuyenTrangThaiDeadline(nutHC.getAttribute("data-hoanthanh"));
        return;
      }
      var nutXoa = e.target.closest(".btn-xoa");
      if (nutXoa && nutXoa.dataset.xoa) {
        xoaDeadline(nutXoa.getAttribute("data-xoa"));
      }
    });
  }

  var oHan = document.getElementById("hanChot");
  if (oHan) oHan.min = ngayCuaHomNay();

  console.log(
    "[hoctap.js] Học tập sẵn sàng — " + dsDeadline.length + " deadline.",
  );
}

/**
 * initDashboard: khởi động khu vực Tổng quan.
 */
function initDashboard() {
  capNhatDashboard();
}

/**
 * khoiDongUngDung: điểm khởi chạy DUY NHẤT của cả app.
 * - Thứ tự là một phần của hợp đồng:
 *   1) ganSuKienTab()  2) initChiTieu() (guard)  3) initHocTap()  4) initDashboard()
 */
function khoiDongUngDung() {
  ganSuKienTab();

  if (typeof initChiTieu === "function") {
    initChiTieu();
  } else {
    console.warn(
      '[hoctap] chitieu.js chưa load — Dashboard chạy ở chế độ "chưa có số liệu".',
    );
  }

  initHocTap();
  initDashboard();

  console.log("[hoctap.js] Đã khởi động xong 3 khu vực.");
}

// C là file load CUỐI cùng -> đăng ký khởi chạy ở đây, chạy khi DOM đã sẵn.
document.addEventListener("DOMContentLoaded", khoiDongUngDung);
