/*
  File: chitieu.js   |  NGƯỜI PHỤ TRÁCH: B (thành viên 2)
  Mục đích: Toàn bộ logic cho khu vực CHI TIÊU:
            thêm/xóa giao dịch, lọc + tìm kiếm, render bảng, tính tổng
            thu - chi - còn lại, và CUNG CẤP số liệu cho Dashboard.

  ================================================================
  HỢP ĐỒNG ĐÃ THỐNG NHẤT (mục 1.3, 1.4 của tài liệu nhóm)
  ================================================================
  1) B ĐỊNH NGHĨA để hoctap.js gọi sang:
       initChiTieu()            -> không
       renderBangChiTieu()      -> không
       renderTongHopChiTieu()   -> không
       getSoDuHienTai()         -> number (đồng, được phép âm)
       getTongThu() / getTongChi()          -> number
       getTongTheoDanhMuc()     -> array [{ danhMuc, tongTien }]
       getGiaoDichGanDay(n)     -> array [{ noiDung, soTien, loai, ngay }]
       getTenDanhMuc(value)     -> string tiếng Việt của danh mục
       (mới) getThongKeTheoNgay() -> array [{ ngay, tongTien }]  (biểu đồ ngày)

  2) B KHÔNG định nghĩa lại formatTienIch / escapeHtml (thuộc về C).
     B dùng 2 hàm bọc an toàn bên dưới: hienThiTien() và lamSachHtml().

  3) Sau khi thêm/xóa: gọi window.capNhatDashboard && window.capNhatDashboard()

  4) localStorage key 'sv.giaoDich.v1' — mảng object:
       { id, noiDung, soTien, loai: 'thu'|'chi', danhMuc, ngay }
     soTien là NUMBER, ngay là 'YYYY-MM-DD'.

  5) ID dùng (khớp index.html): #formChiTieu #noiDung #soTien #ngayChi
     #loaiThu #loaiChi #danhMuc #bangChiTieu #tbodyChiTieu
     #chiTieuTongThu #chiTieuTongChi #chiTieuConLai
     #locDanhMuc #locLoai #timKiemGiaoDich #sapXepNgay #btnXoaToanBo
  ================================================================
*/

/* ================================================================
   BIẾN RIÊNG CỦA FILE B
   ================================================================ */

var KEY_GIAO_DICH = "sv.giaoDich.v1";

// Mảng giao dịch — nguồn dữ liệu duy nhất của khu vực Chi tiêu
var dsGiaoDich = [];

// Bộ lọc + sắp xếp hiện tại của tab Chi tiêu
var boLocGiaoDich = {
  danhMuc: "",
  loai: "",
  tuKhoa: "",
  sapXep: "moi-nhat", // 'moi-nhat' | 'cu-nhat' | 'tien-cao'
};

// Bảng dịch tên danh mục (value -> nhãn tiếng Việt). B sở hữu, C gọi qua getTenDanhMuc()
var TEN_DANH_MUC = {
  "an-uong": "Ăn uống",
  "nha-tro": "Nhà trọ",
  "dien-nuoc": "Điện / nước",
  "di-lai": "Đi lại",
  "hoc-tap": "Học tập",
  "giai-tri": "Giải trí",
  luong: "Lương / trợ cấp",
  khac: "Khác",
};

/* ================================================================
   HÀM BỌC AN TOÀN (dùng tiện ích của C nhưng không chết nếu C chưa load)
   ================================================================ */

/**
 * hienThiTien: in số tiền ra chuỗi đẹp.
 * - Nhận vào: viTri (number|string).
 * - Ưu tiên gọi formatTienIch() của C; nếu chưa có thì tự format tạm.
 * - Trả về: string, ví dụ '1.500.000 đ'.
 */
function hienThiTien(viTri) {
  var so = Number(viTri);
  if (!isFinite(so)) so = 0;
  if (typeof formatTienIch === "function") return formatTienIch(so);
  return so.toLocaleString("vi-VN") + " đ";
}

/**
 * lamSachHtml: escape HTML an toàn cho nội dung user nhập.
 * - Nhận vào: chuoi (bất kỳ).
 * - Ưu tiên escapeHtml() của C, có fallback nếu chưa load.
 * - Trả về: string an toàn để nhét vào innerHTML.
 */
function lamSachHtml(chuoi) {
  if (typeof escapeHtml === "function") return escapeHtml(chuoi);
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
   NHÓM 1 — ĐỌC / GHI LOCALSTORAGE
   ================================================================ */

/**
 * docTuLocalStorage: nạp dsGiaoDich từ key 'sv.giaoDich.v1'.
 * - Bọc try/catch + Array.isArray để sống sót với dữ liệu cũ hỏng.
 * - Lọc bỏ phần tử thiếu field bắt buộc (tránh NaN lan ra tổng).
 */
function docTuLocalStorage() {
  var duLieu = [];
  try {
    duLieu = JSON.parse(localStorage.getItem(KEY_GIAO_DICH)) || [];
  } catch (loi) {
    console.warn("[chitieu] Dữ liệu localStorage hỏng, khởi tạo lại.", loi);
    duLieu = [];
  }

  if (!Array.isArray(duLieu)) duLieu = [];

  dsGiaoDich = duLieu
    .filter(function (gd) {
      return gd && typeof gd === "object" && gd.id && gd.noiDung;
    })
    .map(function (gd) {
      // Chuẩn hóa kiểu dữ liệu: soTien luôn là number
      return {
        id: String(gd.id),
        noiDung: String(gd.noiDung),
        soTien: Number(gd.soTien) || 0,
        loai: gd.loai === "thu" ? "thu" : "chi",
        danhMuc: gd.danhMuc || "khac",
        ngay: gd.ngay || "",
      };
    });
}

/**
 * ghiVaoLocalStorage: ghi toàn bộ dsGiaoDich xuống localStorage.
 */
function ghiVaoLocalStorage() {
  try {
    localStorage.setItem(KEY_GIAO_DICH, JSON.stringify(dsGiaoDich));
  } catch (loi) {
    alert("Không lưu được dữ liệu (localStorage đầy hoặc bị chặn).");
  }
}

/**
 * taoIdMoi: sinh id duy nhất cho một giao dịch.
 * - Trả về: string, ví dụ 'g4k4m9x1a2b'
 */
function taoIdMoi() {
  return "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ================================================================
   NHÓM 2 — VALIDATE FORM
   ================================================================ */

/**
 * xoaToanBoLoi: xóa mọi nhãn lỗi .form-error trong form Chi tiêu.
 */
function xoaToanBoLoi() {
  var cacLoi = document.querySelectorAll("#formChiTieu .form-error");
  for (var i = 0; i < cacLoi.length; i++) cacLoi[i].remove();
}

/**
 * hienLoi: in nhãn lỗi dưới input tương ứng.
 * - Nhận vào: maSoInput (string, ví dụ 'noiDung'), thongBao (string).
 * - Trả về: không.
 */
function hienLoi(maSoInput, thongBao) {
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
 * layLoaiDuocChon: đọc radio name="loai" đang được chọn.
 * - Trả về: 'thu' | 'chi'
 */
function layLoaiDuocChon() {
  var nutThu = document.getElementById("loaiThu");
  return nutThu && nutThu.checked ? "thu" : "chi";
}

/* ================================================================
   NHÓM 3 — THÊM / XÓA GIAO DỊCH
   ================================================================ */

/**
 * themGiaoDich: validate form rồi thêm 1 giao dịch mới.
 * - Nhận vào: e (event submit).
 * - Trả về: boolean true nếu thêm thành công.
 */
function themGiaoDich(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();

  xoaToanBoLoi();

  var noiDung = document.getElementById("noiDung").value.trim();
  var soTienRaw = document.getElementById("soTien").value.trim();
  var ngay = document.getElementById("ngayChi").value;
  var danhMuc = document.getElementById("danhMuc").value;
  var loai = layLoaiDuocChon();

  var soTien = Number(soTienRaw);
  var hopLe = true;

  if (!noiDung) {
    hienLoi("noiDung", "Nhập nội dung giao dịch.");
    hopLe = false;
  }
  if (!soTienRaw || !isFinite(soTien) || soTien <= 0) {
    hienLoi("soTien", "Số tiền phải lớn hơn 0.");
    hopLe = false;
  }
  if (!ngay) {
    hienLoi("ngayChi", "Chọn ngày cho giao dịch.");
    hopLe = false;
  }
  if (!danhMuc) {
    hienLoi("danhMuc", "Chọn một danh mục.");
    hopLe = false;
  }

  if (!hopLe) return false;

  dsGiaoDich.push({
    id: taoIdMoi(),
    noiDung: noiDung,
    soTien: soTien,
    loai: loai,
    danhMuc: danhMuc,
    ngay: ngay,
  });

  ghiVaoLocalStorage();
  renderBangChiTieu();
  renderTongHopChiTieu();

  // Hợp đồng: báo cho Dashboard vẽ lại
  window.capNhatDashboard && window.capNhatDashboard();

  // Reset form, giữ lại loại + danh mục hay dùng cho tiện nhập nhanh
  document.getElementById("noiDung").value = "";
  document.getElementById("soTien").value = "";
  document.getElementById("noiDung").focus();

  return true;
}

/**
 * xoaGiaoDich: xóa 1 giao dịch theo id (có xác nhận).
 * - Nhận vào: idGiaoDich (string).
 */
function xoaGiaoDich(idGiaoDich) {
  var index = -1;
  for (var i = 0; i < dsGiaoDich.length; i++) {
    if (dsGiaoDich[i].id === String(idGiaoDich)) {
      index = i;
      break;
    }
  }
  if (index === -1) return;

  var gd = dsGiaoDich[index];
  if (!confirm('Xóa giao dịch "' + gd.noiDung + '"?')) return;

  dsGiaoDich.splice(index, 1);
  ghiVaoLocalStorage();
  renderBangChiTieu();
  renderTongHopChiTieu();
  window.capNhatDashboard && window.capNhatDashboard();
}

/**
 * xoaToanBoGiaoDich: xóa sạch dữ liệu chi tiêu (nút ở cuối tab).
 */
function xoaToanBoGiaoDich() {
  if (dsGiaoDich.length === 0) {
    alert("Chưa có giao dịch nào để xóa.");
    return;
  }
  if (!confirm("Xóa TOÀN BỘ " + dsGiaoDich.length + " giao dịch?")) return;

  dsGiaoDich = [];
  ghiVaoLocalStorage();
  renderBangChiTieu();
  renderTongHopChiTieu();
  window.capNhatDashboard && window.capNhatDashboard();
}

/* ================================================================
   NHÓM 4 — LỌC / TÌM KIẾM / SẮP XẾP
   ================================================================ */

/**
 * dsGiaoDichDaLoc: trả về mảng đã lọc + sắp xếp theo boLocGiaoDich.
 * - Không sửa mảng gốc.
 * - Trả về: array.
 */
function dsGiaoDichDaLoc() {
  var tuKhoa = boLocGiaoDich.tuKhoa.toLowerCase().trim();

  var ketQua = dsGiaoDich.filter(function (gd) {
    if (boLocGiaoDich.danhMuc && gd.danhMuc !== boLocGiaoDich.danhMuc)
      return false;
    if (boLocGiaoDich.loai && gd.loai !== boLocGiaoDich.loai) return false;
    if (tuKhoa) {
      var ganDay =
        gd.noiDung.toLowerCase().indexOf(tuKhoa) !== -1 ||
        (TEN_DANH_MUC[gd.danhMuc] || "").toLowerCase().indexOf(tuKhoa) !== -1;
      if (!ganDay) return false;
    }
    return true;
  });

  ketQua.sort(function (a, b) {
    if (boLocGiaoDich.sapXep === "tien-cao") return b.soTien - a.soTien;
    if (boLocGiaoDich.sapXep === "cu-nhat") {
      return String(a.ngay).localeCompare(String(b.ngay));
    }
    // mặc định: mới nhất trước
    var soSanh = String(b.ngay).localeCompare(String(a.ngay));
    if (soSanh !== 0) return soSanh;
    return String(b.id).localeCompare(String(a.id));
  });

  return ketQua;
}

/**
 * datBoLoc: đổi một điều kiện lọc rồi vẽ lại bảng.
 * - Nhận vào: tenKhoa ('danhMuc'|'loai'|'tuKhoa'|'sapXep'), giaTri (string).
 */
function datBoLoc(tenKhoa, giaTri) {
  boLocGiaoDich[tenKhoa] = giaTri || "";
  renderBangChiTieu();
}

/**
 * taoDanhSachLoc: nhân bản options của #danhMuc (form) sang #locDanhMuc.
 * - Giữ option "Tất cả" ở đầu.
 */
function taoDanhSachLoc() {
  var nguon = document.getElementById("danhMuc");
  var dich = document.getElementById("locDanhMuc");
  if (!nguon || !dich) return;

  // Xóa hết trừ option "Tất cả" (value = '')
  while (dich.options.length > 1) dich.remove(1);

  for (var i = 0; i < nguon.options.length; i++) {
    var o = nguon.options[i];
    if (!o.value) continue;
    var kha = document.createElement("option");
    kha.value = o.value;
    kha.textContent = o.textContent;
    dich.appendChild(kha);
  }
}

/* ================================================================
   NHÓM 5 — RENDER BẢNG + TỔNG HỢP
   ================================================================ */

/**
 * renderBangChiTieu: vẽ lại #tbodyChiTieu.
 */
function renderBangChiTieu() {
  var tbody = document.getElementById("tbodyChiTieu");
  if (!tbody) return;

  var danhSach = dsGiaoDichDaLoc();

  if (danhSach.length === 0) {
    var thongBao =
      dsGiaoDich.length === 0
        ? "Chưa có giao dịch nào. Thêm giao dịch đầu tiên ở form trên."
        : "Không có giao dịch nào khớp bộ lọc hiện tại.";
    tbody.innerHTML =
      '<tr><td colspan="6" class="empty-row">' + thongBao + "</td></tr>";
    return;
  }

  var html = "";
  for (var i = 0; i < danhSach.length; i++) {
    var gd = danhSach[i];
    var tenLoai = gd.loai === "thu" ? "Thu" : "Chi";
    html +=
      "<tr>" +
      "<td>" +
      lamSachHtml(dinhDangNgay(gd.ngay)) +
      "</td>" +
      "<td>" +
      lamSachHtml(gd.noiDung) +
      "</td>" +
      "<td>" +
      lamSachHtml(getTenDanhMuc(gd.danhMuc)) +
      "</td>" +
      '<td><span class="badge badge--' +
      gd.loai +
      '">' +
      tenLoai +
      "</span></td>" +
      '<td class="col-money text-' +
      gd.loai +
      '">' +
      hienThiTien(gd.soTien) +
      "</td>" +
      '<td><button type="button" class="btn btn--danger btn-xoa" ' +
      'data-xoa="' +
      lamSachHtml(gd.id) +
      '">Xóa</button></td>' +
      "</tr>";
  }
  tbody.innerHTML = html;
}

/**
 * renderTongHopChiTieu: điền tổng thu / tổng chi / còn lại.
 */
function renderTongHopChiTieu() {
  var oThu = document.getElementById("chiTieuTongThu");
  var oChi = document.getElementById("chiTieuTongChi");
  var oConLai = document.getElementById("chiTieuConLai");
  if (!oThu || !oChi || !oConLai) return;

  var tongThu = getTongThu();
  var tongChi = getTongChi();
  var conLai = tongThu - tongChi;

  oThu.textContent = hienThiTien(tongThu);
  oChi.textContent = hienThiTien(tongChi);
  oConLai.textContent = hienThiTien(conLai);

  oConLai.classList.remove("text-thu", "text-chi");
  oConLai.classList.add(conLai < 0 ? "text-chi" : "text-thu");
}

/* ================================================================
   NHÓM 6 — TIỆN ÍCH RIÊNG CỦA B
   ================================================================ */

/**
 * dinhDangNgay: 'YYYY-MM-DD' -> 'dd/MM/yyyy'.
 * - Nhận vào: chuoiNgay (string).
 * - Trả về: string ('' nếu rỗng/không hợp lệ).
 */
function dinhDangNgay(chuoiNgay) {
  if (!chuoiNgay || typeof chuoiNgay !== "string") return "";
  var phan = chuoiNgay.split("-");
  if (phan.length !== 3) return chuoiNgay;
  return phan[2] + "/" + phan[1] + "/" + phan[0];
}

/**
 * getTenDanhMuc: nhãn tiếng Việt của một danh mục.
 * - Nhận vào: giaTri (string, ví dụ 'an-uong').
 * - Trả về: string ('Khác' nếu không tra được).
 * - AI GỌI: bảng của B và biểu đồ của C.
 */
function getTenDanhMuc(giaTri) {
  return TEN_DANH_MUC[giaTri] || "Khác";
}

/* ================================================================
   NHÓM 7 — HÀM CUNG CẤP CHO hoctap.js (HỢP ĐỒNG 1.3)
   ================================================================ */

/** getTongThu: tổng tiền loại 'thu' (number, đơn vị đồng). */
function getTongThu() {
  var tong = 0;
  for (var i = 0; i < dsGiaoDich.length; i++) {
    if (dsGiaoDich[i].loai === "thu") tong += dsGiaoDich[i].soTien;
  }
  return tong;
}

/** getTongChi: tổng tiền loại 'chi' (number DƯƠNG). */
function getTongChi() {
  var tong = 0;
  for (var i = 0; i < dsGiaoDich.length; i++) {
    if (dsGiaoDich[i].loai === "chi") tong += dsGiaoDich[i].soTien;
  }
  return tong;
}

/** getSoDuHienTai: tổng thu - tổng chi (number, được phép âm). */
function getSoDuHienTai() {
  return getTongThu() - getTongChi();
}

/**
 * getTongTheoDanhMuc: gom tiền CHI theo danh mục (cho biểu đồ).
 * - Trả về: array [{ danhMuc, tongTien }] sắp xếp giảm dần.
 */
function getTongTheoDanhMuc() {
  var bang = {};
  for (var i = 0; i < dsGiaoDich.length; i++) {
    var gd = dsGiaoDich[i];
    if (gd.loai !== "chi") continue;
    var key = gd.danhMuc || "khac";
    bang[key] = (bang[key] || 0) + gd.soTien;
  }

  var ketQua = [];
  for (var key in bang) {
    if (Object.prototype.hasOwnProperty.call(bang, key)) {
      ketQua.push({ danhMuc: key, tongTien: bang[key] });
    }
  }
  ketQua.sort(function (a, b) {
    return b.tongTien - a.tongTien;
  });
  return ketQua;
}

/**
 * getThongKeTheoNgay: tổng CHI theo từng ngày (biểu đồ những ngày gần nhất).
 * - Trả về: array [{ ngay: 'YYYY-MM-DD', tongTien }] sắp xếp ngày tăng dần.
 */
function getThongKeTheoNgay() {
  var bang = {};
  for (var i = 0; i < dsGiaoDich.length; i++) {
    var gd = dsGiaoDich[i];
    if (gd.loai !== "chi" || !gd.ngay) continue;
    bang[gd.ngay] = (bang[gd.ngay] || 0) + gd.soTien;
  }

  var ketQua = [];
  for (var key in bang) {
    if (Object.prototype.hasOwnProperty.call(bang, key)) {
      ketQua.push({ ngay: key, tongTien: bang[key] });
    }
  }
  ketQua.sort(function (a, b) {
    return String(a.ngay).localeCompare(String(b.ngay));
  });
  return ketQua.slice(-7);
}

/**
 * getGiaoDichGanDay: n giao dịch mới nhất cho Dashboard.
 * - Nhận vào: soLuong (number, mặc định 5).
 * - Trả về: array [{ noiDung, soTien, loai, ngay }]
 */
function getGiaoDichGanDay(soLuong) {
  var n = Number(soLuong) > 0 ? Number(soLuong) : 5;

  var banSao = dsGiaoDich.slice();
  banSao.sort(function (a, b) {
    var soSanh = String(b.ngay).localeCompare(String(a.ngay));
    if (soSanh !== 0) return soSanh;
    return String(b.id).localeCompare(String(a.id));
  });

  return banSao.slice(0, n).map(function (gd) {
    return {
      noiDung: gd.noiDung,
      soTien: gd.soTien,
      loai: gd.loai,
      ngay: gd.ngay,
    };
  });
}

/**
 * soGiaoDichHienCo: số lượng bản ghi đang có (Dashboard hiển thị "N giao dịch").
 * - Trả về: number
 */
function soGiaoDichHienCo() {
  return dsGiaoDich.length;
}

/* ================================================================
   NHÓM 8 — KHỞI ĐỘNG TAB CHI TIÊU
   ================================================================ */

/**
 * initChiTieu: nạp dữ liệu, vẽ bảng và nối toàn bộ sự kiện.
 * - Được hoctap.js gọi khi DOM đã sẵn sàng.
 */
function initChiTieu() {
  docTuLocalStorage();
  taoDanhSachLoc();

  // Ngày mặc định = hôm nay (tính theo giờ địa phương, không dùng toISOString)
  var oNgay = document.getElementById("ngayChi");
  if (oNgay && !oNgay.value) oNgay.value = ngayHomNay();

  renderBangChiTieu();
  renderTongHopChiTieu();

  // Form
  var form = document.getElementById("formChiTieu");
  if (form) form.addEventListener("submit", themGiaoDich);

  // Nút "Nhập lại" (type=reset) làm trống ngày -> trả lại hôm nay
  if (form) {
    form.addEventListener("reset", function () {
      setTimeout(function () {
        var oNgayReset = document.getElementById("ngayChi");
        if (oNgayReset) oNgayReset.value = ngayHomNay();
      }, 0);
    });
  }

  // Xóa từng dòng — event delegation (gắn 1 lần, không gắn trong vòng lặp render)
  var bang = document.getElementById("bangChiTieu");
  if (bang) {
    bang.addEventListener("click", function (e) {
      var nut = e.target.closest(".btn-xoa");
      if (nut && nut.dataset.xoa) xoaGiaoDich(nut.dataset.xoa);
    });
  }

  // Bộ lọc
  var oLocDanhMuc = document.getElementById("locDanhMuc");
  if (oLocDanhMuc) {
    oLocDanhMuc.addEventListener("change", function () {
      datBoLoc("danhMuc", this.value);
    });
  }

  var oLocLoai = document.getElementById("locLoai");
  if (oLocLoai) {
    oLocLoai.addEventListener("change", function () {
      datBoLoc("loai", this.value);
    });
  }

  var oTim = document.getElementById("timKiemGiaoDich");
  if (oTim) {
    oTim.addEventListener("input", function () {
      datBoLoc("tuKhoa", this.value);
    });
  }

  var oSapXep = document.getElementById("sapXepNgay");
  if (oSapXep) {
    oSapXep.addEventListener("change", function () {
      datBoLoc("sapXep", this.value);
    });
  }

  var oXoaHet = document.getElementById("btnXoaToanBo");
  if (oXoaHet) oXoaHet.addEventListener("click", xoaToanBoGiaoDich);

  console.log("[chitieu.js] Sẵn sàng — " + dsGiaoDich.length + " giao dịch.");
}

/**
 * ngayHomNay: chuỗi 'YYYY-MM-DD' của hôm nay theo giờ máy người dùng.
 * - Trả về: string.
 */
function ngayHomNay() {
  var d = new Date();
  var thang = String(d.getMonth() + 1).padStart(2, "0");
  var ngay = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + thang + "-" + ngay;
}
