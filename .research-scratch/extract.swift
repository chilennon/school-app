import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count > 1 else {
    FileHandle.standardError.write("usage: extract <file.pdf>\n".data(using: .utf8)!)
    exit(1)
}

let url = URL(fileURLWithPath: args[1])
guard let doc = PDFDocument(url: url) else {
    FileHandle.standardError.write("FAILED to open PDF\n".data(using: .utf8)!)
    exit(2)
}

var out = ""
out.reserveCapacity(1 << 20)
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    out += "\n\n===== PAGE \(i + 1) / \(doc.pageCount) =====\n"
    out += page.string ?? ""
}
FileHandle.standardOutput.write(out.data(using: .utf8)!)
