# Git 명령어 정리

## 초기 설정

```bash
# Git 저장소 초기화
git init

# 원격 저장소 연결
git remote add origin https://github.com/username/repo-name.git

# 원격 저장소 확인
git remote -v
```

## 기본 커밋 흐름

```bash
# 1. 모든 파일 스테이징
git add .

# 2. 특정 파일만 스테이징
git add 파일명

# 3. 커밋
git commit -m "커밋 메시지"

# 4. 원격 저장소에 푸시
git push -u origin main
```

## 원격 저장소에서 가져오기

```bash
# 원격 변경사항 가져오고 병합
git pull origin main

# 히스토리가 다른 저장소 병합 시
git pull origin main --allow-unrelated-histories

# 원격 저장소 클론
git clone https://github.com/username/repo-name.git
```

## 상태 확인

```bash
# 현재 상태 확인
git status

# 커밋 로그 확인
git log --oneline

# 변경 내용 확인
git diff
```

## 브랜치

```bash
# 브랜치 목록 확인
git branch

# 브랜치 이름 변경 (master → main)
git branch -M main

# 새 브랜치 생성 후 이동
git checkout -b 브랜치명

# 브랜치 이동
git checkout 브랜치명
```

## 자주 겪는 상황

### push가 거부될 때

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### Vim 편집기가 열렸을 때

`:wq` 입력 후 Enter → 저장하고 나가기

### 커밋 메시지 수정

```bash
git commit --amend -m "수정된 메시지"
```

### 마지막 커밋 취소 (파일은 유지)

```bash
git reset --soft HEAD~1
```
