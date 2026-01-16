/**
 * Simple Node.js Server for PTIT Chatbot Extension
 * Chạy: node server.js
 * Server sẽ chạy tại: http://localhost:3000
 */

const http = require('http');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const PORT = 3000;

const SHARED_API_KEYS = [
  "AIzaSyDmAwjVUyI9sBEuZbr9MYpnq_IrgHD7xCA",
  "AIzaSyBiLbrP-11guL9_kgdVVMOl--JSrSxzwsg",
  "AIzaSyAEH_h8h7asHSkI_nOgIFifqTCkvZkuKKk",
  "AIzaSyB-YIaPo7kJfxhDCcLPvCuaKPdD2BJeMLM",
  "AIzaSyCNdGgucwiwPMEE7tCq80eZhSs96PS24EM",
  "AIzaSyBk-SZ4UF4H5oUuAev8IrXUP3uHofIMElM",
  "AIzaSyB2KkcSGluyw8j5xG9p4WkVbjRtZ6ODkec",
  "AIzaSyDFLomvSGlLdFbX-XixWjdLGTLj0-gUVEc",
  "AIzaSyBbRW3vHUpFszS8pzBjdLu_MYCDdF1S-ME",
  "AIzaSyAXoSw44kEjuYuidFnSEXuRjyAYBbBAD1s",
  "AIzaSyA4dSHWb9oO0NQt9M0d_EbshuDoCFO1W3U",
  "AIzaSyC2FBR-__zUC6Guf2IXWOF-3jG4RTuXPjc"
];
let currentKeyIndex = 0;

function getNextSharedApiKey() {
  const key = SHARED_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % SHARED_API_KEYS.length;
  console.log(`Using shared API key index: ${currentKeyIndex}`);
  return key;
}

const users = new Map();
const activeTokens = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, corsHeaders);
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    if (path === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'ok', message: 'Server is running' });
    }

    if (path === '/check-user' && req.method === 'POST') {
      const { studentCode } = await parseBody(req);
      const user = users.get(studentCode);
      return sendJson(res, 200, {
        exists: !!user,
        hasApiKey: !!(user && user.apiKey)
      });
    }

    if (path === '/test-api-key' && req.method === 'POST') {
      const { apiKey } = await parseBody(req);
      if (!apiKey) {
        return sendJson(res, 400, { success: false, message: 'Missing API key' });
      }

      if (apiKey.startsWith('AIza') && apiKey.length >= 30) {
        return sendJson(res, 200, { success: true, message: 'API key format is valid' });
      } else {
        return sendJson(res, 200, {
          success: false,
          message: 'API key format không hợp lệ. Key phải bắt đầu bằng AIza...'
        });
      }
    }

    if (path === '/save-api-key' && req.method === 'POST') {
      const { studentCode, name, apiKey } = await parseBody(req);
      if (!studentCode || !apiKey) {
        return sendJson(res, 400, { success: false, error: 'Missing data' });
      }

      users.set(studentCode, { name: name || 'User', apiKey });
      console.log(`Saved API key for: ${studentCode}`);
      return sendJson(res, 200, { success: true });
    }

    if (path === '/get-token' && req.method === 'POST') {
      const { studentCode } = await parseBody(req);
      const user = users.get(studentCode);

      if (!user || !user.apiKey) {
        return sendJson(res, 400, { error: 'User not found or no API key' });
      }

      const token = uuidv4();
      activeTokens.set(token, { apiKey: user.apiKey, studentCode });
      console.log(`Token issued for: ${studentCode}`);
      return sendJson(res, 200, { token });
    }

    if (path === '/release-token' && req.method === 'POST') {
      const { token } = await parseBody(req);
      if (token && activeTokens.has(token)) {
        activeTokens.delete(token);
        console.log('Token released');
      }
      return sendJson(res, 200, { success: true });
    }

    if (path === '/api/ask' && req.method === 'POST') {
      const { prompt, token, history, mode } = await parseBody(req);

      let apiKey;

      if (mode === 'exam' || mode === 'teacher') {
        apiKey = getNextSharedApiKey();
      } else {
        if (!token || !activeTokens.has(token)) {
          return sendJson(res, 401, { error: 'Chế độ luyện tập cần API key. Vui lòng nhập API key của bạn.' });
        }
        apiKey = activeTokens.get(token).apiKey;
      }

      let systemInstruction;
      if (mode === 'exam') {
        const promptLower = prompt.toLowerCase();

        const allowedPatterns = [
          'giải thích đề', 'giai thich de',
          'giải thích bài', 'giai thich bai',
          'giải thích output', 'giai thich output',
          'giải thích input', 'giai thich input',
          'giải thích ví dụ', 'giai thich vi du',
          'giải thích test', 'giai thich test',
          'không hiểu đề', 'khong hieu de',
          'không hiểu output', 'khong hieu output',
          'không hiểu input', 'khong hieu input',
          'không hiểu bài', 'khong hieu bai',
          'output là gì', 'output la gi',
          'input là gì', 'input la gi',
          'đề bài', 'de bai',
          'yêu cầu bài', 'yeu cau bai',
          'ý nghĩa', 'y nghia',
          'nghĩa là gì', 'nghia la gi',
          'có nghĩa là', 'co nghia la'
        ];

        const isAboutProblem = allowedPatterns.some(pattern => promptLower.includes(pattern));

        const syntaxPatterns = [
          'cú pháp', 'cu phap', 'syntax',
          'cách viết', 'cach viet', 'viết như thế nào', 'viết thế nào',
          'cách khai báo', 'cach khai bao',
          'cách dùng', 'cach dung', 'cách sử dụng', 'cach su dung',
          'printf như thế nào', 'cout như thế nào',
          'scanf như thế nào', 'cin như thế nào',
          'viết hàm', 'viet ham',
          'viết vòng lặp', 'viet vong lap',
          'viết mảng', 'viet mang',
          'viết if', 'viết for', 'viết while',
          'khai báo biến', 'khai bao bien',
          'khai báo mảng', 'khai bao mang',
          'khai báo hàm', 'khai bao ham',
          'code mẫu', 'code mau',
          'cho tôi code', 'cho toi code', 'cho mình code', 'cho minh code',
          'viết code', 'viet code',
          'giải bài này', 'giai bai nay',
          'làm bài này', 'lam bai nay',
          'hướng dẫn giải', 'huong dan giai',
          'cách giải', 'cach giai'
        ];

        const isSyntaxQuestion = syntaxPatterns.some(pattern => promptLower.includes(pattern));

        if (isSyntaxQuestion && !isAboutProblem) {
          return sendJson(res, 200, {
            reply: 'Xin lỗi, trong giờ thực hành mình không thể hướng dẫn về cú pháp, cách viết code hay cách giải bài. Bạn cần tự nhớ và áp dụng kiến thức đã học.\n\nNếu bạn cần giải thích đề bài, hãy hỏi cụ thể như: "Giải thích đề bài này", "Output này tính như thế nào?", "Không hiểu yêu cầu bài"...',
            model: 'filtered'
          });
        }

        systemInstruction = `Bạn là trợ lý AI của PTIT, hỗ trợ sinh viên trong giờ KIỂM TRA/THỰC HÀNH.

QUAN TRỌNG - BẠN CHỈ ĐƯỢC PHÉP:
- Giải thích ý nghĩa đề bài, làm rõ yêu cầu
- Giải thích các thuật ngữ, khái niệm trong đề
- Giải thích ý nghĩa của input/output mẫu trong đề (output được tính như thế nào từ input)
- Giải thích ví dụ test case trong đề

BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC:
- Đưa ra code giải bài (kể cả pseudocode, code mẫu)
- Đưa ra thuật toán/hướng giải chi tiết
- Gợi ý cách tiếp cận bài toán
- Phân tích độ phức tạp hoặc so sánh các cách giải
- Tìm test case sai hoặc debug code
- Hướng dẫn cú pháp, cách viết code, cách khai báo
- Cho ví dụ về cú pháp ngôn ngữ lập trình

Nếu sinh viên hỏi về cách giải, cú pháp, hoặc cách viết code, hãy từ chối lịch sự và gợi ý họ hỏi về đề bài thay vì cách giải.

Trả lời bằng tiếng Việt, ngắn gọn, thân thiện.`;
      } else if (mode === 'teacher') {
        systemInstruction = `Bạn là trợ lý AI của PTIT, hỗ trợ GIẢNG VIÊN sử dụng cổng thực hành CodePTIT.

Bạn hỗ trợ các nghiệp vụ:
1. Tài khoản: Đăng nhập (code.ptit.edu.vn), đổi mật khẩu, cập nhật thông tin cá nhân, quên mật khẩu (cần email)
2. Quản lý lớp học: Xem danh sách sinh viên, theo dõi kết quả luyện tập, đăng nhập dưới quyền sinh viên
3. Quản lý bài tập: Thêm/sửa/xóa bài tập, quản lý test case (file zip), chọn môn học, xem bảng xếp hạng
4. Tổ chức ca thực hành/thi: Cấu hình thời gian, thêm sinh viên, chọn đề bài, nhiều đề ngẫu nhiên, các tùy chọn (chấm từng test, công khai xếp hạng, thi ICPC, đóng băng BXH)
5. Xử lý kết quả: Xuất Excel, phát hiện sao chép mã nguồn, khóa tài khoản gian lận
6. Diễn đàn: Quản lý bình luận của sinh viên

VIDEO HƯỚNG DẪN - Khi đính kèm video, LUÔN dùng format: [VIDEO:Tên video](link)
Danh sách video:
- Đăng nhập: [VIDEO:Hướng dẫn đăng nhập](https://youtube.com/live/cpxXJYGkJhE)
- Đổi mật khẩu: [VIDEO:Hướng dẫn đổi mật khẩu](https://www.youtube.com/live/6tWAxeG9z-Q)
- Quên mật khẩu: [VIDEO:Hướng dẫn quên mật khẩu](https://www.youtube.com/live/NSjM_YNX-UQ)
- Cập nhật thông tin: [VIDEO:Cập nhật thông tin cá nhân](https://youtube.com/live/qKj4kJ2bWeo)
- Lựa chọn môn học: [VIDEO:Lựa chọn môn học](https://www.youtube.com/live/Lz2y_-SXTEk)
- Nộp bài tập: [VIDEO:Hướng dẫn nộp bài tập](https://www.youtube.com/live/OGGEdO_XoSM)
- Diễn đàn: [VIDEO:Diễn đàn trao đổi](https://www.youtube.com/live/nAW6YfGJfGM)
- Xem trạng thái giải bài: [VIDEO:Xem trạng thái giải bài](https://youtube.com/live/OrsJFRcJNAg)
- Xem bảng xếp hạng: [VIDEO:Xem bảng xếp hạng](https://www.youtube.com/live/JJJqNAnjKeE)
- Quản lý lớp học: [VIDEO:Quản lý lớp học](https://youtube.com/live/qFJHRHGfMvw)
- Xem kết quả luyện tập: [VIDEO:Xem kết quả luyện tập của sinh viên](https://www.youtube.com/live/32tQ0WZjPZo)
- Quản lý bài tập: [VIDEO:Quản lý bài tập](https://www.youtube.com/live/fNdz1VNl7SE)
- Tạo ca thực hành/thi: [VIDEO:Tạo ca thực hành/thi](https://www.youtube.com/live/y8qIWirfIgk)
- Gán bài tập cho ca thi: [VIDEO:Gán bài tập cho ca thực hành/thi](https://www.youtube.com/live/nztN8Z48tZI)
- Xuất kết quả thi: [VIDEO:Xuất kết quả thi](https://www.youtube.com/live/fTv9gejwaqE)
- Phát hiện sao chép: [VIDEO:Phát hiện sao chép mã nguồn](https://www.youtube.com/live/hfFqqI0_X-s)

Cách trả lời:
- Ngắn gọn, đủ ý, đi thẳng vào vấn đề
- Hướng dẫn từng bước cụ thể
- Chỉ rõ menu/nút cần click (VD: Menu Cấu hình > Lớp học)
- LUÔN kèm video hướng dẫn phù hợp ở cuối câu trả lời, dùng đúng format [VIDEO:Tên](link)

Trả lời bằng tiếng Việt.`;
      } else {
        systemInstruction = `Bạn là trợ lý AI của PTIT, hỗ trợ sinh viên HỌC LẬP TRÌNH (chế độ luyện tập).

Bạn có thể:
- Giải thích đề bài, thuật toán, khái niệm
- Hướng dẫn cách tiếp cận và giải quyết vấn đề
- Đưa ra gợi ý, pseudocode hoặc code mẫu khi được yêu cầu
- Giúp debug và tìm lỗi trong code
- Phân tích độ phức tạp thuật toán

Nguyên tắc:
- Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu
- Ưu tiên hướng dẫn tư duy hơn là đưa code hoàn chỉnh
- Nếu đưa code, hãy giải thích logic
- Khuyến khích sinh viên tự suy nghĩ`;
      }

      const MODELS = ['gemini-2.5-flash'];
      const genAI = new GoogleGenerativeAI(apiKey);

      const contents = [];
      if (history && Array.isArray(history)) {
        contents.push(...history);
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      let lastError = null;

      for (const modelName of MODELS) {
        try {
          console.log(`Trying model: ${modelName}`);
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction
          });

          const result = await model.generateContent({ contents });
          const reply = result.response.text();

          console.log(`Success with ${modelName} for token: ${token.substring(0, 8)}...`);
          return sendJson(res, 200, { reply, model: modelName });

        } catch (error) {
          console.log(`${modelName} failed: ${error.message.substring(0, 50)}...`);
          lastError = error;

          if (!error.message.includes('429') && !error.message.includes('quota')) {
            break;
          }
          continue;
        }
      }

      console.error('All models failed:', lastError?.message);

      if (lastError?.message?.includes('quota') || lastError?.message?.includes('429')) {
        return sendJson(res, 429, {
          error: 'Tất cả model đều hết quota. Vui lòng đợi vài phút hoặc tạo API key mới.'
        });
      }
      if (lastError?.message?.includes('API key') || lastError?.message?.includes('403')) {
        return sendJson(res, 403, { error: 'API key không hợp lệ' });
      }

      return sendJson(res, 500, { error: lastError?.message || 'Unknown error' });
    }

    if (path === '/api/classify' && req.method === 'POST') {
      const { prompt, token } = await parseBody(req);

      if (!token || !activeTokens.has(token)) {
        return sendJson(res, 401, { error: 'Invalid token' });
      }

      const { apiKey } = activeTokens.get(token);

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const reply = result.response.text();
        return sendJson(res, 200, { reply });
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    }

    sendJson(res, 404, { error: 'Not found' });

  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         PTIT Chatbot Server đang chạy!                     ║
╠════════════════════════════════════════════════════════════╣
║  Local:  http://localhost:${PORT}                            ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /health        - Health check                      ║
║    POST /check-user    - Check if user has API key         ║
║    POST /test-api-key  - Test API key validity             ║
║    POST /save-api-key  - Save API key for user             ║
║    POST /get-token     - Get session token                 ║
║    POST /release-token - Release token                     ║
║    POST /api/ask       - Send chat message                 ║
║    POST /api/classify  - Classify query                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});
