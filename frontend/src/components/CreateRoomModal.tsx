import React from 'react';

interface CreateRoomModalProps {
  id: string;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ id }) => {
  return (
    <div className="modal fade" id={id} tabIndex={-1} aria-labelledby={`${id}Label`} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-primary text-white border-0">
            <h5 className="modal-title fw-bold" id={`${id}Label`}>Tạo Phòng Mới</h5>
            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body p-4">
            <form>
              <div className="mb-4">
                <label htmlFor="stakeAmount" className="form-label fw-semibold">Số tiền cược (SUI)</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-coin text-warning"></i>
                  </span>
                  <input 
                    type="number" 
                    className="form-control bg-light border-start-0" 
                    id="stakeAmount" 
                    placeholder="Ví dụ: 1.0" 
                    step="0.1" 
                    min="0"
                  />
                </div>
                <div className="form-text mt-2 text-muted">
                  Số tiền này sẽ được khóa vào Smart Contract cho đến khi có kết quả.
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="secretCode" className="form-label fw-semibold">Mã bí mật (Secret Salt)</label>
                <div className="secure-input-wrapper">
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-dark text-white border-end-0">
                      <i className="bi bi-shield-lock-fill text-info"></i>
                    </span>
                    <input 
                      type="password" 
                      className="form-control bg-dark border-dark text-white border-start-0" 
                      id="secretCode" 
                      placeholder="Nhập mã bảo mật của bạn"
                    />
                  </div>
                  <div className="security-badge mt-2">
                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle w-100 py-2">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      QUAN TRỌNG: Đừng làm mất mã này! Bạn cần nó để nhận thưởng.
                    </span>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div className="modal-footer border-0 p-4 pt-0">
            <button type="button" className="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Hủy</button>
            <button type="button" className="btn btn-primary rounded-pill px-4 shadow">Xác nhận tạo phòng</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal;
