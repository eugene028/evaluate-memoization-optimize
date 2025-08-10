const { BaseAnalysis, getFullHeapFromFile } = require("memlab");

class MyAnalysisTest extends BaseAnalysis {
  getCommandName() {
    return "my-analysis"; //분석 스크립트 이름을 명명하는 코드
  }

  getDescription() {
    return "useMemo를 통해 저장된 메모리와 useCallback을 통하여 저장된 메모리 값을 계산합니다.";
  }

  async process(options) {
    const heap = await getFullHeapFromFile(
      "./snapshots/real_final_stg2(620).heapsnapshot"
    );

    let totalUseMemoSize = 0;

    heap.nodes.forEach((node) => {
      //여러 노드 중 React FiberNode를 찾습니다.

      if (node.name === "FiberNode") {
        //해당 노드가 참조하고 있는 값들 중에서 memoizedState를 찾습니다.

        const memoStateRef = node.references.find(
          (ref) => ref.name_or_index === "memoizedState"
        );
        if (!memoStateRef) return;

        //memoizedState를 통해 linked list로 연결된 노드를 찾습니다.
        let hookNode = memoStateRef.toNode;

        //linked list를 순회하며 useMemo와 useCallback을 찾습니다.
        while (hookNode) {
          const memoizedValRef = hookNode.references.find(
            (ref) => ref.name_or_index === "memoizedState"
          );
          const memoizedValue = memoizedValRef?.toNode;

          let isUseMemo = false;
          let isUseCallback = false;

          if (memoizedValue) {
            const type = memoizedValue.type;
            const valueObj = memoizedValue.getJSONifyableObject?.() ?? {};
            //useCallback은 클로저 함수를 반환함
            if (type === "closure") {
              isUseCallback = true;

              //useMemo는 memoizedState의 type이 object 또는 array이고, create, destroy, deps가 없는 경우입니다.(생명주기) useEffect를 제외하기 위함
            } else if (type === "object" || type === "array") {
              const hasEffectShape =
                valueObj?.create || valueObj?.destroy || valueObj?.deps;
              if (!hasEffectShape) {
                isUseMemo = true;
              }
            }

            if (isUseMemo || isUseCallback) {
              totalUseMemoSize += memoizedValue.self_size;
            }
          }
          const nextRef = hookNode.references.find(
            (ref) => ref.name_or_index === "next"
          );
          hookNode = nextRef?.toNode;
        }
      }
    });

    console.log(
      "메모지에이션이 차지하고 있는 용량:",
      totalUseMemoSize,
      "bytes"
    );
  }
}
module.exports = MyAnalysisTest;
