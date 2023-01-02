from django.shortcuts import render

# Create your views here.
# HTTPResponseというクラスをインポート
# from django.http import HttpResponse

# View関数を任意に定義
def index(request):

    context={'result_sample1':"sample", 'result_sample2':"sample2"}

    # ほしいものリストを取得
    


    return render(request, 'librarySiteApp/index.html', context=context)