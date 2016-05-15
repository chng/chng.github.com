---
layout: post
title: 自己动手实现allocator
date: 2014-11-14
categories: C++
tag:
	- C++
	- STL
	
---


### 碎碎念
最近在追旧番《STL代码剖析》。真的是很旧很旧的番了，STL在94年开始走入STL，这本书则是2002年出版的，C++03和C++11还不知何在的年代。看完第二章之后合上书，想自己写一个allocator。发现看书过程中自认为“所言极是”的地方，居然根本写不出来。虽然从前也写过内存池 (mempool)，但是STL的手法和我等闲辈果然不是一个层次。于是只好边写边翻书，也算顺利得写出来了一个不支持fill和copy的版本。毕竟，`stl_uninitialized`相对于`stl_construct`和`stl_alloc`简单多了，我个人也不常用它来初始化容器。

本来一个简单的事情，写完后发现`malloc_alloc`好用，`default_alloc`却不好用，也是，memory pool自然比最naive的`placement new`和`free`要简单了。检查到最后，发现似乎alloc忘记写return res了！加上return运行，走起！发现自己写程序，总是写到最后就忘记return了，果然爱旅行的人还是太年轻，总是忘记回家的路呢。

(PS：`unordered_map`、`auto`和`<<>>`等语法特性需要`std_c++11`的支持哦)


### STL内存分配：

STL Alloc与slab、tcmalloc等异曲同工，原理上有许多相似之处。

1. 大块直接malloc和free，内存不够时使用handler试图产生更多内存；

2. 小块内存使用内存池，避免因为小块内存散落在各处，造成大量外部碎片，同时提高内存分配效率。

### `my_alloc.h`:

~~~ C++
/* my_alloc.h */
#include <cstdlib> //for malloc and free
#include "my_traits.h"

#if 0
#   include <new>
#   define __THROW_BAD_ALLOC throw bad_alloc;
#else
#   include <iostream>
    using namespace std;
#   define __THROW_BAD_ALLOC {cerr<<"out of memory"<<endl; exit(1);};
#endif

//#define __USE_MALLOC_ALLOC 0

/* first level allocator */
/* __malloc_alloc_template */
template<int inst>
class __malloc_alloc_template
{
private:
    //out of memory
    //keep trying alloc until succeed
    static void* oom_alloc(size_t bytes)
    {
        set_malloc_handler(0);
        void * res = 0;
        while(1)
        {
            if(!__malloc_alloc_oom_handler) {__THROW_BAD_ALLOC;}
            (*__malloc_alloc_oom_handler)();
            if(res = malloc(bytes)) return res;
        }
    }
    static void* oom_realloc(void* p, size_t bytes)
    {
        set_malloc_handler(0);
        void * res = 0;
        while(1)
        {
            if(!__malloc_alloc_oom_handler) __THROW_BAD_ALLOC;
            (*__malloc_alloc_oom_handler)();
            if(res = realloc(p, bytes)) return res;
        }
    }
    static void (* __malloc_alloc_oom_handler)();

    //set the malloc handler function as f
    static void (* set_malloc_handler( void (*f)() )) ()
    {
        void (*old)() = __malloc_alloc_oom_handler;
        __malloc_alloc_oom_handler = f;
        return old;
    }
public:
    static void* allocate(size_t bytes)
    {
        void * res = malloc(bytes);
        if(!res) res = oom_alloc(bytes);
        return res;
    }
    static void deallocate(void* p, size_t bytes)
    {
        /*
        char * q = p;
        while(bytes--)
        {
            free(q);
            q++;
        }
        */
        free(p);
    }
    static void* reallocate(void* p, size_t bytes)
    {
        void * res = realloc(p, bytes);
        if(!res) res = oom_realloc(p, bytes);
        return res;
    }
};
template<int inst>
void (* __malloc_alloc_template<inst>::__malloc_alloc_oom_handler)() = 0;

typedef __malloc_alloc_template<0> malloc_alloc;

/* end of __malloc_alloc_template */

//memory pool
/* __default_alloc_template */

enum {MIN_BLOCK = 8, MAX_BLOCK = 128, NFREELISTS = MAX_BLOCK/MIN_BLOCK};

union obj
{
    obj* free_list_link;
    char client_data[1];
};

template <bool threads, int inst>
class __default_alloc_template
{

    static obj* freelist[NFREELISTS];
    //start of memory pool
    static char* start_free;
    //end of memory pool
    static char* end_free;
    //size of the whole memory pool
    static size_t heap_size;

private:
    //n -> 8*m
    //eg. 7->8, 8->8, 9->16
    static size_t ROUND_UP(size_t n)
    {
    //n -> freelist_index
    //eg. 7->0, 8->0, 9->1, 16->1
        return (n + MIN_BLOCK - 1) & ~(MIN_BLOCK-1);
    }
    static size_t FREELIST_INDEX(size_t n)
    {
        return (n/MIN_BLOCK - 1);
    }
    static char* chunk_alloc(size_t size, int & nobjs)
    {
        char* res = 0;
        size_t bytes_needed = nobjs * size;
        size_t bytes_left = end_free - start_free;
        //if the left space meets the demand, allocate and return
        if(bytes_needed <= bytes_left)
        {
            res = start_free;
            start_free += bytes_needed;
            return res;
        }
        //if the left space partially meets the demand, allocate
        if(size <= bytes_left)
        {
            res = start_free;
            nobjs = bytes_left/size;
            start_free += nobjs * size; //note that nobjs*size != bytes_left
            return res;
        }
        //if the left space cannot meets even one block demand,
        size_t bytes_to_get = 2 * bytes_needed + ROUND_UP(heap_size >> 4); //bytes which are to be gained.
        //put the left part into the correct freelist
        if(bytes_left > 0)
        {
            obj** my_freelist = freelist + FREELIST_INDEX(bytes_left);
            ((obj*)(start_free))->free_list_link = *my_freelist;
            *my_freelist = (obj*)(start_free);
        }
        //and try to gain more space from the heap.
        start_free = static_cast<char*>(malloc(bytes_to_get));
        if(0 == start_free)
        {
            int i;
            obj ** my_freelist;
            //search unused blocks in the freelist whose size le "size", and reuse it
            //otherwise the space in the freelist might grow huge.
            for(i=size; i<MAX_BLOCK; i+=MIN_BLOCK)
            {
                my_freelist = freelist + FREELIST_INDEX(i);
                obj* p = *my_freelist;
                if(p)
                {
                    *my_freelist = p->free_list_link;
                    start_free = (char*)(p);
                    end_free = start_free + i;
                    //now end_free - start_free == i >= size
                    return (chunk_alloc(size, nobjs));
                }
            }
            //end_free = 0; /?
            //turn to malloc_alloc::oom_alloc if failed.
            start_free = static_cast<char*>(malloc_alloc::allocate(bytes_to_get));
        }
        end_free = start_free + bytes_to_get;
        heap_size += bytes_to_get;
        return chunk_alloc(size, nobjs);
    }

    //n should be 8*m
    static void* refill(size_t n)
    {
        //the default refill number of the block of size n
        int nobjs = 20;
        char* chunk = chunk_alloc(n, nobjs);
        obj** my_freelist = freelist + FREELIST_INDEX(n);
        obj* res;
        obj* cur;
        int i;

        //if chunk_alloc only return 1 block;
        if(1 == nobjs) return (chunk);
        //else if many blocks are chunked
        res = (obj*)(chunk);
        *my_freelist = cur = (obj*)((char*)(res)+n);
        for(i=2; i<nobjs; i++)
        {
            cur->free_list_link = (obj*)((char*)(cur)+n);
            cur = cur->free_list_link;
        }
        cur->free_list_link = 0;
        return res;
    }

public:
    static void * allocate(size_t bytes)
    {
        if(MAX_BLOCK < bytes) return malloc_alloc::allocate(bytes);
        //gain a space from freelist
        obj** my_freelist = freelist + FREELIST_INDEX(bytes);
        obj* res = *my_freelist;
        if(0 == res)
        {
            return refill(ROUND_UP(bytes));
        }
        *my_freelist = res->free_list_link;
        return res;
    }
    static void deallocate(void* p, size_t bytes)
    {
        if(MAX_BLOCK < bytes){ malloc_alloc::deallocate(p, bytes);return; }
        //return the deallocated space to freelist;
        obj** my_freelist = freelist + FREELIST_INDEX(bytes);
        static_cast<obj*>(p)->free_list_link = *my_freelist;
        *my_freelist = static_cast<obj*>(p);
    }
};

template <bool threads, int inst>
char* __default_alloc_template<threads, inst>::start_free = 0;
template <bool threads, int inst>
char* __default_alloc_template<threads, inst>::end_free = 0;
template <bool threads, int inst>
size_t __default_alloc_template<threads, inst>::heap_size = 0;
template <bool threads, int inst>
obj * __default_alloc_template<threads, inst>::freelist[NFREELISTS]={0};

/* end of __default_alloc_template */

#define __NODE_ALLOCATOR_THREADS 0

#ifdef __USE_MALLOC_ALLOC
    typedef malloc_alloc alloc;
#else
    typedef __default_alloc_template<__NODE_ALLOCATOR_THREADS, 0> alloc;
#endif // __USE_MALLOC

/* simple_alloc */
template<class T, class Alloc=alloc>
class simple_alloc
{
public:
    typedef T           value_type;
    typedef T*          pointer;
    typedef const T*    const_pointer;
    typedef T&          reference;
    typedef const T&    const_reference;
    typedef size_t      size_type;
    typedef ptrdiff_t   difference_type;
public:
    static T* allocate(size_t n)
    {
        if(n==0) return 0;
        return static_cast<T*>(Alloc::allocate(n*sizeof(T)));
    }
    static const T* allocate(void)
    {
        return Alloc::allocate(sizeof(T));
    }
    //释放多个
    static void deallocate(T* p, size_t n)
    {
        if(0!=n) Alloc::deallocate(p, n*sizeof(T));
    }
    //释放一个
    static void deallocate(T* p)
    {
        Alloc::deallocate(p, sizeof(T));
    }

}; /* end of simple_alloc */

/* end of my_alloc.h */
     对象构造与析构：根据type_traits进行析构（私以为构造也可如此，如int等基本类型则不必构造，直接malloc出来即可用）

~~~

### `my_constructor.h`:

~~~ C++
/* my_constructor.h */
#include <iostream>
#include "my_traits.h"
using namespace std;


    template<class T, class T1>
    inline void construct(T* p, const T1& value)
    {
        new (p) T1(value);
    }

    template<class T>
    inline  void destroy(T* p)
    {
        typename __my_traits<T>::has_trivial_destructor a;
        return destroy(p, a);
    }
    template<class T>
    inline  void destroy(T* p, __true_)
    {
        cerr << "I am a trivial destructor"<<endl;
    }
    template<class T>
    inline  void destroy(T* p, __false_)
    {
        cerr << "I am not a trivial destructor."<<endl;
        p->~T();
    }

    template<class T>
    inline void destroy(T* p, T* t)
    {
        typename __my_traits<T>::has_trivial_destructor a;
        return destroy(p, t, a);
    }
    template<class T>
    inline void destroy(T* f, T* t, __true_)
    {
    }
    template<class T>
    inline void destroy(T* f, T* t, __false_)
    {
        while(f<t)
        {
            destroy(f);
            f++;
        }
    }

    inline void destroy(char *, char * p=0){}
    inline void destroy(wchar_t *, wchar_t * p=0){}
    inline void destroy(int *, int * p=0){}
    inline void destroy(size_t *, size_t * p=0){}
    inline void destroy(long long *, long long * p=0){}
    // ...

/* end of my_constructor.h*/

~~~

### 型别萃取:
类型特征萃取（type traits）：通过模板传给traits，再通过统一的类型名称传递类型信息（要求用户类中定义好那些统一的类型名称，并用true或false指定实际的类型）

类型特征全部用不同的数据类型表示，而不用数值（宏、枚举等）表示：

1. 压榨效率，数值需要在运行时加以判断，而数据类型是编译阶段决定好的

2. 针对不同的类型特征，可定义重载函数而不是在同一个函数中加入if else分支，使得代码更加清晰。

`type_traits`最主要的作用，是使得不同类型的类得以被区别对待，避免为无作为的构造或析构付出不必要的函数调用代价。

从STL Alloc中的`freelist`联合体的设计，到traits方法，管中窥豹，可知STL是如何看重性能问题的。

下面是“山寨版”的traits。

### `my_traits`
~~~ C++
/* my_traits.h */

#ifndef __TRUE_
#define __TRUE_
struct __true_ {};
#endif // __TRUE_
#ifndef __FALSE_
#define __FALSE_
struct __false_ {};
#endif // __FALSE_

#ifndef __MY_TRAITS
#define __MY_TRAITS
template <class _Tp>
struct __my_traits {
   typedef __true_     this_dummy_member_must_be_first;
   // 不要移除这个成员
   // 它通知能自动特化__type_traits的编译器, 现在这个__type_traits template是特化的
   // 这是为了确保万一编译器使用了__type_traits而与此处无任何关联的模板时
   // 一切也能顺利运作

   // 以下条款应当被遵守, 因为编译器有可能自动生成类型的特化版本
   //  - 你可以重新安排的成员次序
   //  - 你可以移除你想移除的成员
   //  - 一定不可以修改下列成员名称, 却没有修改编译器中的相应名称
   //  - 新加入的成员被当作一般成员, 除非编译器提供特殊支持

   typedef __false_    has_trivial_default_constructor;
   typedef __false_    has_trivial_copy_constructor;
   typedef __false_    has_trivial_assignment_operator;
   typedef __false_    has_trivial_destructor;
   typedef __false_    is_POD_type;
};

template <>
struct __my_traits<int>
{
   typedef __false_    has_trivial_default_constructor;
   typedef __false_    has_trivial_copy_constructor;
   typedef __false_    has_trivial_assignment_operator;
   typedef __false_    has_trivial_destructor;
   typedef __false_    is_POD_type;
};

#endif // __MY_TRAITS


/* end of my_traits.h */
~~~

通常为某些可以批量初始化的容器而设计的fill和copy函数，通过type_traits提取出具体的类型信息，并区别对待：

1. 对于trivial的类，只需要调用memcopy等简单地内存函数即可；
2. 于复杂的类，则需要调用（复制）构造函数，以避免浅复制带来的错误。


（部分函数体未补充完整）
### `my_uninitialized.h `
~~~C++
/* my_uninitialized.h */

#include "my_traits.h"
#include <cstring>

template<class T>
T* uninitialized_fill(T* f, T* t, const T& x)
{
    typename __my_traits<T>::is_POD_type a;
    return uninitialized_fill(f, t, x);
}
template<class T>
T* uninitialized_fill(T* f, T* t, const T& x, __true_)
{
}
template<class T>
T* uninitialized_fill(T* f, T* t, const T& x, __false_)
{

}

template<class T>
T* uninitialized_fill_n(T* f, size_t n, const T& x)
{
    typename __my_traits<T>::is_POD_type a;
    return uninitialized_fill(f, t, x, a);
}
template<class T>
T* uninitialized_fill_n(T* f, size_t n, const T& x, __true_)
{
    return fill_n(f, n, x);
}
template<class T>
T* uninitialized_fill_n(T* f, size_t n, const T& x, __false_)
{
    while(f<t)
    {
        construct(f, x);
        f++;
    }
}

template<class T>
T* uninitialized_copy(const T* srcs, const T* srcf, T* dest)
{
}
template<class T>
T* uninitialized_copy(const T* srcs, const T* srcf, T* dest, __true_)
{
    return copy(srcs, srcf, dest);
}
template<class T>
T* uninitialized_copy(const T* srcs, const T* srcf, T* dest, __true_)
{
}

/* end of my_uninitialized.h */
~~~

最后试着用上面的配置器（allocator、constructor和uninitialized）写一个简单的vector容器：

### `vector.h`	

~~~
/* vector.h */
#include <memory>
#include "my_alloc.h"
#include "my_construct.h"

template <class T, class Alloc=alloc>
class vector
{
public:
    typedef T value_type;
    typedef T* pointer;
    typedef T* iterator;
    typedef T& reference;
    typedef size_t size_type;
    typedef ptrdiff_t difference_type;

    typedef simple_alloc<T, Alloc> alloc;
    iterator start;
    iterator finish;
    iterator storige_end;

public:

    vector():start(0), finish(0), storige_end(0) {}
    //加上explicite防止编译器进行隐式转换
    explicit vector(size_type n)
    {
        start = Alloc::allocate(n);
        uninitialized_fill_n(start, n, T()); //此时T必须有空参数的构造函数，（否则会不会调用默认构造函数？）
        finish = start + n;
    }
    vector(size_type n, const T& x)
    {
        start = Alloc::allocate(n);
        uninitialized_fill_n(start, n, T(x));
        finish = start + n;
    }
    vector(iterator from, iterator to)
    {
        size_type len = static_cast<size_type>(to-from);
        start = Alloc::allocate(len);
        uninitialized_copy(from, to, start);
        finish = start + len;
    }
    ~vector()
    {
        if(start){
            destroy(start, finish);
            Alloc::deallocate(start, capacity());
        }
    }
    const iterator begin() {return start;}
    const iterator end() {return finish;}
    size_type size() const
    {return static_cast<size_type>(finish - start);}
    size_type capacity() const
    {return static_cast<size_type>(storige_end - start);}
    bool empty() const
    {return start==finish;}

    //真的需要?
    void deallocate()
    {
        start && Alloc::deallocate(start, capacity());
    }
    void push_back(const T& x)
    {
        insert(finish, x);
    }
    //注意，诸如fill和copy这种将数据源复制到多个变量的函数，
    //要考虑到所修改的内存空间是否会覆盖到数据源所在的空间
    void insert(iterator pos, const T x)
    {
        //空间足够
        if(finish!=storige_end)
        {
            construct(finish, *(finish-1));
            uninitialized_copy(pos, finish, pos+1);
            *pos = x;
            finish++;
        }
        else
        {
            size_type old_size = size();
            size_type new_size = 1;
            iterator new_start, new_finish;

            if(old_size) new_size = old_size << 1;
            new_start = new_finish = Alloc::allocate(new_size);

            //能否不用try catch
            try{
                new_finish = uninitialized_copy(start, pos, new_start);
                construct(new_finish++, x);
                new_finish = uninitialized_copy(pos, finish, new_finish);
            }
            catch(...)
            {
                if(new_start)
                {
                    //释放之前真的需要析构？
                    //需要。因为T变量中可能包含指向配置器以外的其他空间的指针。
                    destroy(new_start, new_finish);
                    Alloc::deallocate(new_start, new_size);
                }
                throw;
            }
            //释放之前真的需要析构？
            //需要！因为T变量中可能包含指向配置器外的其他空间的指针
            if(start){
                destroy(start, finish);
                //释放
                Alloc::deallocate(start, old_size);
            }
            //调整迭代器
            start = new_start;
            finish = new_finish;
            storige_end = new_start + new_size;
        }
    }
    void pop_back()
    {
        Alloc::destroy(--finish);
    }
};
/* end of vector.h */
~~~ 

最后测试，用简单类型、string类型（测试深复制）和自定义的结构体类型：

### `main.cpp`

~~~C++
/* main.cpp */

#include <iostream>
#include "vector.h"
#include <auto_ptr.h>

/* main-my-vector.cpp*/
#pragma pack(4)
struct s
{
    int i;
    int j;
    char c;
    explicit s(int _i, int _j=0):i(_i), j(_j){}
    ~s(){}
};
#pragma pack()

ostream & operator << (ostream & o, const s& _s)
{
    o << "(" <<_s.i<< ", " <<_s.j<<")";
    return o;
}

main()
{
    typedef string T;
    cout <<"sizeof(T) "<<sizeof(T)<<endl;
    auto_ptr<vector<T, simple_alloc<T>>> pv(new vector<T, simple_alloc<T>> ());
    vector<T, simple_alloc<T>> &v = (*pv);
    //vector<T, simple_alloc<T>> v;
    for(int i=0; i<10; i++)
    {
        v.push_back(T("xx"));
        cout <<v.capacity()<<endl;
    }
    vector<T, simple_alloc<T>>::iterator it;
    for(it=v.begin(); it!=v.end(); it++)
        cout <<(*it)<<endl;
    cout <<endl;
}
/* end of main.cpp */
 
~~~

### The End
看过jjhou翻译的Effective C++系列之后，深深地变成了他的脑残粉。本来本着闲着没事追追星的心态去看STL代码剖析，不到1/5的内容里，我已经被STL大师深深折服。不愧是大师，代码写得面面俱到，宏定义用得如火纯青，光是allocator就秒杀只会写new和delete的5星渣渣。建议和我一样的C++新手们也去看看，看完就不是新手啦！
